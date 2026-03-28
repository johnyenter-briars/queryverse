use log::{debug, error};
use serde::Serialize;
use std::collections::HashMap;

use crate::{
    Database,
    auth::{
        connection::load_connections, serviceclient::get_or_create_service_client,
        settings::load_settings,
    },
    binding::model::{
        backgroundjobstatus::{BackgroundJobResult, BackgroundJobState, BackgroundJobStatus},
        executesqljobstartresponse::ExecuteSqlJobStartResponse,
        executesqlrequest::ExecuteSqlRequest,
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        resultrow::ResultRow,
    },
    jobs::{complete_select_job, fail_job, insert_job, store_job_result_rows, update_job_progress},
    sql::{
        self, aggregate,
        util::{
            assign_row_numbers, fill_entity_reference_names,
            filter_requires_local_companion_evaluation, lookup_attribute_set,
            push_down_lookup_type_filters,
        },
    },
};
use powerplatform_dataverse_client::{
    LogLevel,
    dataverse::{
        entity::{Entity, Value},
        serviceclient::ServiceClient,
    },
};
use uuid::Uuid;

use super::metadata::{get_entity_attributes_cached, get_entity_definitions_cached};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchXmlPreview {
    pub entity_set: String,
    pub entity_logical: String,
    pub fetch_xml: String,
}

#[tauri::command]
pub async fn parse_sql_to_fetchxml(
    _window: tauri::Window,
    sql: String,
) -> Result<FetchXmlPreview, String> {
    let parsed = sql::api::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;
    let settings = load_settings().unwrap_or_default();
    let fetch_xml = if settings.fetch_xml_single_quotes {
        parsed.fetchxml.replace('"', "'")
    } else {
        parsed.fetchxml
    };

    Ok(FetchXmlPreview {
        entity_set: parsed.entity_set,
        entity_logical: parsed.entity_logical,
        fetch_xml,
    })
}

#[tauri::command]
pub async fn execute_sql(
    window: tauri::Window,
    request: ExecuteSqlRequest,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<ExecuteSqlJobStartResponse, String> {
    let connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| connection.id().as_ref() == Some(&connection_id))
        .ok_or("Connection not found")?;

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;
    let stmt = sql::api::parse(&request.sql).map_err(|e| e.to_string())?;
    let (_, entity_logical) = sql::names::resolve_entity_names(&stmt.entity);
    let _ = get_entity_definitions_cached(&service_client, &database, connection_id).await;
    let entity_attributes = get_entity_attributes_cached(
        &service_client,
        &database,
        connection_id,
        &entity_logical,
        context.log_level,
    )
    .await?;

    let sql_text = request.sql.clone();
    let log_level = context.log_level;
    let job_id = Uuid::new_v4().to_string();

    insert_job(
        &database.background_jobs,
        BackgroundJobStatus {
            job_id: job_id.clone(),
            kind: "select".to_string(),
            state: BackgroundJobState::Running,
            current_batch: 0,
            total_batches: 0,
            processed: 0,
            total: 0,
            message: "Queued select job.".to_string(),
            result: None,
        },
    )
    .await;

    let job_store = database.background_jobs.clone();
    let job_result_store = database.background_job_results.clone();
    let queued_job_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        update_job_progress(
            &job_store,
            &queued_job_id,
            BackgroundJobState::Running,
            0,
            0,
            0,
            0,
            "Running select job.".to_string(),
        )
        .await;

        let outcome = execute_sql_with_client_and_progress(
            &service_client,
            &sql_text,
            log_level,
            Some(&entity_attributes),
            |processed, total, current_batch, total_batches, message| {
                let job_store = job_store.clone();
                let job_id = queued_job_id.clone();
                tauri::async_runtime::spawn(async move {
                    update_job_progress(
                        &job_store,
                        &job_id,
                        BackgroundJobState::Running,
                        current_batch,
                        total_batches,
                        processed,
                        total,
                        message,
                    )
                    .await;
                });
            },
        )
        .await;

        match outcome {
            Ok(response) => {
                store_job_result_rows(
                    &job_result_store,
                    &queued_job_id,
                    BackgroundJobResult::Select(response.clone()),
                )
                .await;

                complete_select_job(&job_store, &queued_job_id, response).await;
            }
            Err(error) => {
                fail_job(&job_store, &queued_job_id, 0, 0, 0, 0, error).await;
            }
        }
    });

    Ok(ExecuteSqlJobStartResponse {
        success: true,
        message: "Select job queued.".to_string(),
        job_id,
    })
}

pub async fn execute_sql_with_client(
    service_client: &ServiceClient,
    sql_text: &str,
    log_level: LogLevel,
    entity_attributes: Option<
        &[powerplatform_dataverse_client::dataverse::entityattribute::EntityAttribute],
    >,
) -> Result<ExecuteSqlResponse, String> {
    execute_sql_with_client_and_progress(
        service_client,
        sql_text,
        log_level,
        entity_attributes,
        |_, _, _, _, _| {},
    )
    .await
}

pub async fn execute_sql_with_client_and_progress<F>(
    service_client: &ServiceClient,
    sql_text: &str,
    log_level: LogLevel,
    entity_attributes: Option<
        &[powerplatform_dataverse_client::dataverse::entityattribute::EntityAttribute],
    >,
    mut on_progress: F,
) -> Result<ExecuteSqlResponse, String>
where
    F: FnMut(usize, usize, usize, usize, String),
{
    if matches!(log_level, LogLevel::Debug) {
        debug!("SQL: {}", sql_text);
    }

    let stmt = sql::api::parse(sql_text).map_err(|e| e.to_string())?;
    let lookup_bases = entity_attributes.map(lookup_attribute_set);
    let mut execution_stmt = stmt.clone();
    if let Some(lookup_bases) = &lookup_bases {
        let _ = push_down_lookup_type_filters(&mut execution_stmt, lookup_bases);
    }
    let requires_local_companion_filter = lookup_bases.as_ref().is_some_and(|lookup_bases| {
        filter_requires_local_companion_evaluation(execution_stmt.filter.as_ref(), lookup_bases)
    });
    let fetch_stmt = if requires_local_companion_filter {
        let mut fetch_stmt = execution_stmt.clone();
        fetch_stmt.filter = None;
        fetch_stmt.top = None;
        fetch_stmt
    } else {
        execution_stmt.clone()
    };
    let parsed = sql::api::to_fetchxml_with_lookup_bases(&fetch_stmt, lookup_bases.as_ref())
        .map_err(|e| e.to_string())?;

    let columns_order = parsed
        .column_outputs
        .iter()
        .map(|name| name.strip_prefix("col_").unwrap_or(name).to_string())
        .collect::<Vec<String>>();

    let columns_selected = !columns_order.is_empty();

    let (rows, message, success): (Vec<ResultRow>, String, bool) = if let Some(plan) =
        aggregate::aggregate_fallback_plan(&stmt)
    {
        let is_joined = !stmt.joins.is_empty();
        if is_joined {
            let server = retrieve_entities_with_progress(
                service_client,
                &parsed.entity_set,
                &parsed.fetchxml,
                &mut on_progress,
            )
            .await;

            match server {
                Ok(entities) => {
                    let mut rows: Vec<ResultRow> = entities
                        .into_iter()
                        .map(|entity| aggregate::entity_to_result_row(entity, &columns_order))
                        .collect();
                    fill_entity_reference_names(&mut rows, &columns_order);
                    (
                        aggregate::apply_having(rows, &stmt)?,
                        "Multiple results found".to_string(),
                        true,
                    )
                }
                Err(error) => {
                    if error.contains("0x8004e023") {
                        let demoted_fetchxml = aggregate::demote_aggregate_fetchxml(
                            &parsed.fetchxml,
                            &plan,
                            lookup_bases.as_ref(),
                        )?;
                        let entities = retrieve_entities_with_progress(
                            service_client,
                            &parsed.entity_set,
                            &demoted_fetchxml,
                            &mut on_progress,
                        )
                        .await
                        .map_err(|error| {
                            error!("Error: {error}");
                            error
                        })?;

                        let mut rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
                        fill_entity_reference_names(&mut rows, &columns_order);
                        let mut rows = aggregate::apply_having(rows, &stmt)?;
                        aggregate::sort_rows_by_order(&mut rows, &stmt.order_by);
                        assign_row_numbers(&mut rows);
                        (rows, "Multiple results found".to_string(), true)
                    } else {
                        error!("Error: {error}");
                        return Err(error);
                    }
                }
            }
        } else if plan.is_count_only() {
            let count_fetchxml = aggregate::demote_count_fetchxml(&parsed.fetchxml)?;
            let total = service_client
                .retrieve_multiple_fetchxml_count(&parsed.entity_set, &count_fetchxml)
                .await
                .map_err(|error| {
                    error!("Error: {error}");
                    error
                })?;

            let mut attributes = HashMap::new();
            let output = plan
                .count_output()
                .ok_or_else(|| "Count aggregate output was unavailable.".to_string())?;

            attributes.insert(output.to_string(), Value::Int(total as i64));

            aggregate::ensure_columns(&mut attributes, &columns_order);

            let mut rows = aggregate::apply_having(vec![ResultRow { attributes }], &stmt)?;
            fill_entity_reference_names(&mut rows, &columns_order);
            assign_row_numbers(&mut rows);
            (rows, "Count retrieved.".to_string(), true)
        } else {
            let demoted_fetchxml = aggregate::demote_aggregate_fetchxml(
                &parsed.fetchxml,
                &plan,
                lookup_bases.as_ref(),
            )?;
            let entities = retrieve_entities_with_progress(
                service_client,
                &parsed.entity_set,
                &demoted_fetchxml,
                &mut on_progress,
            )
            .await
            .map_err(|error| {
                error!("execute_sql retrieve_multiple_fetchxml (aggregate) failed: {error}");
                error
            })?;

            let mut rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
            fill_entity_reference_names(&mut rows, &columns_order);
            let mut rows = aggregate::apply_having(rows, &stmt)?;
            aggregate::sort_rows_by_order(&mut rows, &stmt.order_by);
            assign_row_numbers(&mut rows);
            (rows, "Multiple results found".to_string(), true)
        }
    } else {
        let entities = retrieve_entities_with_progress(
            service_client,
            &parsed.entity_set,
            &parsed.fetchxml,
            &mut on_progress,
        )
        .await
        .map_err(|error| {
            error!("execute_sql retrieve_multiple_fetchxml failed: {error}");
            error
        })?;

        let mut rows: Vec<ResultRow> = entities
            .into_iter()
            .map(|entity| aggregate::entity_to_result_row(entity, &columns_order))
            .collect();
        fill_entity_reference_names(&mut rows, &columns_order);
        if requires_local_companion_filter {
            rows = aggregate::apply_where(rows, &stmt)?;
            if let Some(top) = stmt.top {
                rows.truncate(top as usize);
            }
        }
        assign_row_numbers(&mut rows);
        (rows, "Multiple results found".to_string(), true)
    };

    Ok(ExecuteSqlResponse {
        message,
        success,
        value: rows,
        metadata: SqlQueryMetadata {
            columns_selected,
            columns_order,
            entity_logical_name: Some(parsed.entity_logical),
        },
    })
}

async fn retrieve_entities_with_progress<F>(
    service_client: &ServiceClient,
    entity_set: &str,
    fetchxml: &str,
    on_progress: &mut F,
) -> Result<Vec<Entity>, String>
where
    F: FnMut(usize, usize, usize, usize, String),
{
    service_client
        .retrieve_multiple_fetchxml_paging_with_progress(
            entity_set,
            fetchxml,
            |page, processed| {
                on_progress(
                    processed,
                    0,
                    page,
                    0,
                    format!("Selected {processed} record(s), batch {page}."),
                );
            },
            None,
        )
        .await
}
