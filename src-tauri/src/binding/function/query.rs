use serde::Serialize;
use std::collections::HashMap;

use crate::{
    Database, LogLevel, auth::{connection::load_connections, token::get_access_token}, binding::model::{
        dataverse::{
            entity::{Entity, ResultRow, Value as RowValue},
            entityattribute::EntityAttribute,
            entitydefinition::EntityDefinition,
        },
        executesqlrequest::ExecuteSqlRequest,
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        response::MultipleResponse,
    }, dataverse::queryengine::QueryEngine, sql
};

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

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);

    let (rows, message, success): (Vec<ResultRow>, String, bool) =
        if let Some((count_alias, group_columns)) = count_group_by_spec(&stmt) {
            let demoted_fetchxml = demote_groupby_fetchxml(&parsed.fetchxml)?;
            let resp = query_engine
                .retrieve_multiple_fetchxml(&parsed.entity_set, &demoted_fetchxml)
                .await
                .map_err(|error| {
                    println!("Error: {error}");
                    error
                })?;

            let mut groups: HashMap<Vec<std::string::String>, (HashMap<std::string::String, RowValue>, i64)> =
                HashMap::new();

            for entity in resp.value {
                let row = entity_to_result_row(entity, &columns_order);
                let mut key_parts: Vec<std::string::String> = Vec::new();
                let mut group_values: HashMap<std::string::String, RowValue> = HashMap::new();

                for column in &group_columns {
                    let value = row
                        .attributes
                        .get(column)
                        .cloned()
                        .unwrap_or(RowValue::Null);
                    key_parts.push(value_key(&value));
                    group_values.entry(column.clone()).or_insert(value);
                }

                let entry = groups.entry(key_parts).or_insert((group_values, 0));
                entry.1 += 1;
            }

            let mut rows: Vec<ResultRow> = Vec::with_capacity(groups.len());
            let mut row_number = 1i64;
            for (_, (mut group_values, count)) in groups {
                group_values.insert(count_alias.clone(), RowValue::Int(count));
                group_values.insert(ROW_NUMBER_ATTRIBUTE.to_string(), RowValue::Int(row_number));
                ensure_columns(&mut group_values, &columns_order);
                rows.push(ResultRow {
                    attributes: group_values,
                });
                row_number += 1;
            }

            (rows, resp.message, resp.success)
        } else if let Some(count_alias) = count_only_alias(&stmt) {
            let count_fetchxml = demote_count_fetchxml(&parsed.fetchxml)?;
            let total = query_engine
                .retrieve_multiple_fetchxml_count(&parsed.entity_set, &count_fetchxml)
                .await
                .map_err(|error| {
                    println!("Error: {error}");
                    error
                })?;

            let mut attributes = HashMap::new();
            attributes.insert(count_alias.clone(), RowValue::Int(total as i64));
            attributes.insert(ROW_NUMBER_ATTRIBUTE.to_string(), RowValue::Int(1));
            ensure_columns(&mut attributes, &columns_order);

            (vec![ResultRow { attributes }], "Count retrieved.".to_string(), true)
        } else {
            let resp = query_engine
                .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
                .await
                .map_err(|error| {
                    println!("Error: {error}");
                    error
                })?;

            (
                resp.value
                    .into_iter()
                    .map(|entity| entity_to_result_row(entity, &columns_order))
                    .collect(),
                resp.message,
                resp.success,
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

#[tauri::command]
pub async fn list_entity_definitions(
    _window: tauri::Window,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<MultipleResponse<EntityDefinition>, String> {
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

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);
    let value = query_engine.list_entity_definitions().await?;

    Ok(MultipleResponse {
        message: "Metadata retrieved.".to_string(),
        success: true,
        value,
    })
}

#[tauri::command]
pub async fn list_entity_attributes(
    _window: tauri::Window,
    logical_name: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<MultipleResponse<EntityAttribute>, String> {
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

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);
    let value = query_engine
        .list_entity_attributes(&logical_name)
        .await?;

    Ok(MultipleResponse {
        message: "Attributes retrieved.".to_string(),
        success: true,
        value,
    })
}

fn entity_to_result_row(entity: Entity, columns_order: &[String]) -> ResultRow {
    let mut attributes = std::collections::HashMap::new();
    for (key, value) in entity.attributes {
        let normalized_key = if let Some(base) = key.strip_prefix("col_") {
            if attributes.contains_key(base) {
                key
            } else {
                base.to_string()
            }
        } else {
            key
        };
        attributes.insert(normalized_key, value);
    }

    ensure_columns(&mut attributes, columns_order);

    ResultRow {
        attributes,
    }
}

const ROW_NUMBER_ATTRIBUTE: &str = "__rownum";

fn count_only_alias(stmt: &sql::SelectStmt) -> Option<String> {
    if stmt.distinct || !stmt.group_by.is_empty() {
        return None;
    }

    let columns = match &stmt.columns {
        sql::SelectColumns::Columns(items) => items,
        _ => return None,
    };

    if columns.len() != 1 {
        return None;
    }

    let item = &columns[0];
    let aggregate = match &item.kind {
        sql::SelectItemKind::Aggregate(aggregate) => aggregate,
        _ => return None,
    };

    if aggregate.function != sql::AggregateFunction::Count {
        return None;
    }

    if let Some(alias) = &item.alias {
        return Some(alias.clone());
    }

    match &aggregate.target {
        sql::AggregateTarget::Star => Some("count".to_string()),
        sql::AggregateTarget::Column(column) => Some(format!("count_{}", column)),
    }
}

fn demote_count_fetchxml(fetchxml: &str) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" aggregate=\"count\"", "");
    Ok(updated)
}

fn count_group_by_spec(
    stmt: &sql::SelectStmt,
) -> Option<(std::string::String, Vec<std::string::String>)> {
    if stmt.group_by.is_empty() {
        return None;
    }

    let items = match &stmt.columns {
        sql::SelectColumns::Columns(items) => items,
        _ => return None,
    };

    let mut count_alias: Option<std::string::String> = None;
    let mut group_columns: Vec<std::string::String> = Vec::new();

    for item in items {
        match &item.kind {
            sql::SelectItemKind::Attribute(name) => {
                let display = item
                    .alias
                    .clone()
                    .unwrap_or_else(|| name.clone());
                let matches_group = stmt
                    .group_by
                    .iter()
                    .any(|group| group == name || item.alias.as_ref().is_some_and(|alias| alias == group));
                if !matches_group {
                    return None;
                }
                group_columns.push(display);
            }
            sql::SelectItemKind::Aggregate(aggregate) => {
                if aggregate.function != sql::AggregateFunction::Count {
                    return None;
                }
                if count_alias.is_some() {
                    return None;
                }
                let alias = if let Some(alias) = &item.alias {
                    alias.clone()
                } else {
                    match &aggregate.target {
                        sql::AggregateTarget::Star => "count".to_string(),
                        sql::AggregateTarget::Column(column) => {
                            format!("count_{}", column)
                        }
                    }
                };
                count_alias = Some(alias);
            }
        }
    }

    count_alias.map(|alias| (alias, group_columns))
}

fn demote_groupby_fetchxml(fetchxml: &str) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" groupby=\"true\"", "");
    strip_aggregate_attributes(&updated)
}

fn strip_aggregate_attributes(fetchxml: &str) -> Result<String, String> {
    let mut output = std::string::String::new();
    let mut remaining = fetchxml;

    loop {
        let start = match remaining.find("<attribute") {
            Some(pos) => pos,
            None => {
                output.push_str(remaining);
                break;
            }
        };

        output.push_str(&remaining[..start]);
        let attr_end = remaining[start..]
            .find("/>")
            .ok_or_else(|| "Invalid FetchXML attribute tag".to_string())?
            + start
            + 2;
        let attr_block = &remaining[start..attr_end];
        if !attr_block.contains("aggregate=\"") {
            output.push_str(attr_block);
        }

        remaining = &remaining[attr_end..];
    }

    Ok(output)
}

fn ensure_columns(
    attributes: &mut HashMap<std::string::String, RowValue>,
    columns_order: &[String],
) {
    for column in columns_order {
        attributes.entry(column.clone()).or_insert(RowValue::Null);
    }
}

fn value_key(value: &RowValue) -> std::string::String {
    match value {
        RowValue::Int(i) => i.to_string(),
        RowValue::Float(f) => f.to_string(),
        RowValue::String(s) => s.clone(),
        RowValue::Boolean(b) => b.to_string(),
        RowValue::Null => "null".to_string(),
    }
}
