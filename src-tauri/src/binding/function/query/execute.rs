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
        executesqlrequest::ExecuteSqlRequest,
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        resultrow::ResultRow,
    },
    sql::{
        self, aggregate,
        util::{assign_row_numbers, fill_entity_reference_names},
    },
};
use powerplatform_dataverse_client::{
    LogLevel,
    dataverse::{entity::Value, serviceclient::ServiceClient},
};

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
    let parsed = sql::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;
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
    _window: tauri::Window,
    request: ExecuteSqlRequest,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<ExecuteSqlResponse, String> {
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
        get_or_create_service_client(&connection, &database, context.log_level).await?;
    let stmt = sql::parse(&request.sql).map_err(|e| e.to_string())?;
    let parsed = sql::to_fetchxml(&stmt).map_err(|e| e.to_string())?;
    let _ = get_entity_definitions_cached(&service_client, &database, connection_id).await;
    let _ = get_entity_attributes_cached(
        &service_client,
        &database,
        connection_id,
        &parsed.entity_logical,
        context.log_level,
    )
    .await;

    execute_sql_with_client(&service_client, &request.sql, context.log_level).await
}

pub async fn execute_sql_with_client(
    service_client: &ServiceClient,
    sql_text: &str,
    log_level: LogLevel,
) -> Result<ExecuteSqlResponse, String> {
    if matches!(log_level, LogLevel::Debug) {
        debug!("SQL: {}", sql_text);
    }

    let stmt = sql::parse(sql_text).map_err(|e| e.to_string())?;
    let parsed = sql::to_fetchxml(&stmt).map_err(|e| e.to_string())?;

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
            let server = service_client
                .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
                .await;

            match server {
                Ok(entities) => (
                    entities
                        .into_iter()
                        .map(|entity| aggregate::entity_to_result_row(entity, &columns_order))
                        .collect(),
                    "Multiple results found".to_string(),
                    true,
                ),
                Err(error) => {
                    if error.contains("0x8004e023") {
                        let demoted_fetchxml =
                            aggregate::demote_aggregate_fetchxml(&parsed.fetchxml, &plan)?;
                        let entities = service_client
                            .retrieve_multiple_fetchxml(&parsed.entity_set, &demoted_fetchxml)
                            .await
                            .map_err(|error| {
                                error!("Error: {error}");
                                error
                            })?;

                        let mut rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
                        fill_entity_reference_names(&mut rows, &columns_order);
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

            let mut rows = vec![ResultRow { attributes }];
            fill_entity_reference_names(&mut rows, &columns_order);
            assign_row_numbers(&mut rows);
            (rows, "Count retrieved.".to_string(), true)
        } else {
            let demoted_fetchxml = aggregate::demote_aggregate_fetchxml(&parsed.fetchxml, &plan)?;
            let entities = service_client
                .retrieve_multiple_fetchxml(&parsed.entity_set, &demoted_fetchxml)
                .await
                .map_err(|error| {
                    error!("execute_sql retrieve_multiple_fetchxml (aggregate) failed: {error}");
                    error
                })?;

            let mut rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
            fill_entity_reference_names(&mut rows, &columns_order);
            aggregate::sort_rows_by_order(&mut rows, &stmt.order_by);
            assign_row_numbers(&mut rows);
            (rows, "Multiple results found".to_string(), true)
        }
    } else {
        let entities = service_client
            .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
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
        },
    })
}
