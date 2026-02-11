use serde::Serialize;
use std::collections::HashMap;

use crate::{
    auth::{connection::load_connections, token::get_access_token},
    binding::model::{
        executesqlrequest::ExecuteSqlRequest,
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        resultrow::ResultRow,
    },
    sql::{self, aggregate},
    Database, LogLevel,
};
use powerplatform_dataverse_client::dataverse::{entity::Value, serviceclient::ServiceClient};

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

    Ok(FetchXmlPreview {
        entity_set: parsed.entity_set,
        entity_logical: parsed.entity_logical,
        fetch_xml: parsed.fetchxml,
    })
}

#[tauri::command]
pub async fn execute_sql(
    _window: tauri::Window,
    request: ExecuteSqlRequest,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<ExecuteSqlResponse, String> {
    if matches!(context.log_level, LogLevel::Debug) {
        println!("SQL: {}", request.sql);
    }

    let stmt = sql::parse(&request.sql).map_err(|e| e.to_string())?;

    let parsed = sql::to_fetchxml(&stmt).map_err(|e| e.to_string())?;

    let columns_order = parsed
        .column_outputs
        .iter()
        .map(|name| name.strip_prefix("col_").unwrap_or(name).to_string())
        .collect::<Vec<String>>();

    let columns_selected = !columns_order.is_empty();

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

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();

    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);
    let _ = get_entity_definitions_cached(&service_client, &database, connection_id).await;
    let _ = get_entity_attributes_cached(
        &service_client,
        &database,
        connection_id,
        &parsed.entity_logical,
        context.log_level,
    )
    .await;

    let (rows, message, success): (Vec<ResultRow>, String, bool) =
        if let Some(plan) = aggregate::aggregate_fallback_plan(&stmt) {
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
                                    println!("Error: {error}");
                                    error
                                })?;

                            let rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
                            (rows, "Multiple results found".to_string(), true)
                        } else {
                            println!("Error: {error}");
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
                        println!("Error: {error}");
                        error
                    })?;

                let mut attributes = HashMap::new();
                let output = plan.count_output().ok_or_else(|| {
                    "Count aggregate output was unavailable.".to_string()
                })?;
                attributes.insert(output.to_string(), Value::Int(total as i64));
                attributes.insert(aggregate::ROW_NUMBER_ATTRIBUTE.to_string(), Value::Int(1));
                aggregate::ensure_columns(&mut attributes, &columns_order);

                (vec![ResultRow { attributes }], "Count retrieved.".to_string(), true)
            } else {
                let demoted_fetchxml = aggregate::demote_aggregate_fetchxml(
                    &parsed.fetchxml,
                    &plan,
                )?;
                let entities = service_client
                    .retrieve_multiple_fetchxml(&parsed.entity_set, &demoted_fetchxml)
                    .await
                    .map_err(|error| {
                        println!("Error: {error}");
                        error
                    })?;

                let rows = aggregate::aggregate_rows(entities, &plan, &columns_order);
                (rows, "Multiple results found".to_string(), true)
            }
        } else {
            let entities = service_client
                .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
                .await
                .map_err(|error| {
                    println!("Error: {error}");
                    error
                })?;

            (
                entities
                    .into_iter()
                    .map(|entity| aggregate::entity_to_result_row(entity, &columns_order))
                    .collect(),
                "Multiple results found".to_string(),
                true,
            )
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
