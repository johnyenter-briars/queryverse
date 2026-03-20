use log::{debug, error};
use powerplatform_dataverse_client::dataverse::requestparameters::RequestParameters;
use uuid::Uuid;

use crate::{
    UpdateSet,
    Database,
    auth::{
        connection::load_connections, serviceclient::get_or_create_service_client,
        settings::load_settings,
    },
    binding::model::{
        backgroundjobstatus::{BackgroundJobState, BackgroundJobStatus},
        updatesqlexecuteresponse::UpdateSqlExecuteResponse,
        updatesqljobstartresponse::UpdateSqlJobStartResponse,
        updatesqlpreviewresponse::UpdateSqlPreviewResponse,
    },
    jobs::{complete_update_job, fail_job, insert_job, store_job_result_rows, update_job_progress},
    sql,
};

use super::helpers::{
    build_update_attributes, normalize_ident, resolve_primary_id_attribute,
    validate_update_attributes, value_to_string,
};
use super::metadata::{get_entity_attributes_cached, get_entity_definitions_cached};
use super::writebatch::{clamp_batch_size, execute_update_batches_with_progress};

#[tauri::command]
pub async fn prepare_update_sql(
    window: tauri::Window,
    sql: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<UpdateSqlPreviewResponse, String> {
    if context.log_level.includes_debug() {
        debug!("SQL: {}", sql);
    }

    let stmt = sql::parse_update(&sql).map_err(|e| e.to_string())?;

    if stmt.filter.is_none() {
        return Err("UPDATE statements must include a WHERE clause.".to_string());
    }

    if stmt.assignments.is_empty() {
        return Err("UPDATE statements must include at least one SET assignment.".to_string());
    }

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

    let (entity_set, entity_logical) = sql::resolve_entity_names(&stmt.entity);
    let definitions =
        get_entity_definitions_cached(&service_client, &database, connection_id).await?;
    let primary_id_attribute =
        resolve_primary_id_attribute(&definitions, &entity_logical, &entity_set)?;

    let attributes = get_entity_attributes_cached(
        &service_client,
        &database,
        connection_id,
        &entity_logical,
        context.log_level,
    )
    .await
    .map_err(|error| {
        error!("Error: {error}");
        error
    })?;

    if stmt.assignments.iter().any(|assignment| {
        normalize_ident(&assignment.column) == normalize_ident(&primary_id_attribute)
    }) {
        return Err("UPDATE cannot modify the primary ID attribute.".to_string());
    }

    validate_update_attributes(
        &stmt.assignments,
        &stmt.entity,
        stmt.entity_alias.as_deref(),
        &attributes,
    )?;

    let fetch = sql::update_to_fetchxml(&stmt, &primary_id_attribute).map_err(|e| e.to_string())?;

    let entities = service_client
        .retrieve_multiple_fetchxml_paging(&fetch.entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            error!("prepare_update_sql retrieve_multiple_fetchxml failed: {error}");
            error
        })?;

    let mut ids: Vec<String> = Vec::new();
    for entity in entities {
        let value = entity
            .attributes
            .get(&primary_id_attribute)
            .ok_or_else(|| "Primary ID attribute missing from results".to_string())?;
        let id =
            value_to_string(value).ok_or_else(|| "Primary ID attribute was null".to_string())?;
        ids.push(id);
    }

    let updates = build_update_attributes(
        &stmt.assignments,
        &stmt.entity,
        stmt.entity_alias.as_deref(),
    )?;

    let token = Uuid::new_v4().to_string();
    let batch = UpdateSet {
        connection_id,
        entity_set,
        entity_logical,
        primary_id_attribute,
        ids,
        updates,
    };
    let count = batch.ids.len();

    {
        let mut batches = database
            .update_batches
            .lock()
            .map_err(|_| "Failed to lock update state".to_string())?;
        batches.insert(token.clone(), batch);
    }

    Ok(UpdateSqlPreviewResponse {
        success: true,
        message: "Update preview ready.".to_string(),
        count,
        token,
    })
}

#[tauri::command]
pub async fn execute_update_sql(
    window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<UpdateSqlJobStartResponse, String> {
    let batch = {
        let mut batches = database
            .update_batches
            .lock()
            .map_err(|_| "Failed to lock update state".to_string())?;
        batches
            .remove(&token)
            .ok_or_else(|| "Update batch not found or expired.".to_string())?
    };

    let current_connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    if current_connection_id != batch.connection_id {
        return Err("Connection changed since preview; re-run the update preview.".to_string());
    }

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| connection.id().as_ref() == Some(&current_connection_id))
        .ok_or("Connection not found")?;

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;
    let settings = load_settings().unwrap_or_default();
    let request_parameters = RequestParameters {
        bypass_business_logic_execution_custom_sync: settings
            .bypass_business_logic_execution_custom_sync,
        bypass_business_logic_execution_custom_async: settings
            .bypass_business_logic_execution_custom_async,
        bypass_custom_plugin_execution: settings.bypass_custom_plugin_execution,
        suppress_callback_registration_expander_job: settings
            .suppress_callback_registration_expander_job,
    };
    let job_id = Uuid::new_v4().to_string();
    let total = batch.ids.len();
    let batch_size = clamp_batch_size(settings.dataverse_default_batch_size);
    let total_batches = total.div_ceil(batch_size);

    insert_job(
        &database.background_jobs,
        BackgroundJobStatus {
            job_id: job_id.clone(),
            kind: "update".to_string(),
            state: BackgroundJobState::Running,
            current_batch: 0,
            total_batches,
            processed: 0,
            total,
            message: format!("Queued update job for {total} record(s)."),
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
            total_batches,
            0,
            total,
            format!("Running update job for {total} record(s) in {total_batches} batch(es)."),
        )
        .await;

        let outcome = execute_update_batches_with_progress(
            &service_client,
            &batch,
            &request_parameters,
            batch_size,
            |processed, total, current_batch, total_batches| {
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
                        format!(
                            "Processed {processed} of {total} record(s), batch {current_batch} of {total_batches}."
                        ),
                    )
                    .await;
                });
            },
        )
        .await;

        match outcome {
            Ok((updated, failed, errors)) => {
                let success = failed == 0;
                let message = if success {
                    format!("Updated {} record(s).", updated)
                } else {
                    format!("Updated {} record(s) with {} error(s).", updated, failed)
                };
                let response = UpdateSqlExecuteResponse {
                    success,
                    message,
                    updated,
                    failed,
                    errors,
                };

                store_job_result_rows(
                    &job_result_store,
                    &queued_job_id,
                    crate::binding::model::backgroundjobstatus::BackgroundJobResult::Update(
                        response.clone(),
                    ),
                )
                .await;

                complete_update_job(
                    &job_store,
                    &queued_job_id,
                    response,
                )
                .await;
            }
            Err(error) => {
                fail_job(
                    &job_store,
                    &queued_job_id,
                    0,
                    total_batches,
                    0,
                    total,
                    error,
                )
                .await;
            }
        }
    });

    Ok(UpdateSqlJobStartResponse {
        success: true,
        message: "Update job queued.".to_string(),
        job_id,
    })
}

#[tauri::command]
pub async fn discard_update_sql(
    _window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
) -> Result<bool, String> {
    let mut batches = database
        .update_batches
        .lock()
        .map_err(|_| "Failed to lock update state".to_string())?;
    Ok(batches.remove(&token).is_some())
}
