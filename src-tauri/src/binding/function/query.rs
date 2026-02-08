use serde::Serialize;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    Database, LogLevel, auth::{connection::load_connections, token::get_access_token}, binding::model::{
        dataverse::{
            entity::{Entity, ResultRow, Value as RowValue},
            entityattribute::EntityAttribute,
            entitydefinition::EntityDefinition,
        },
        executesqlrequest::ExecuteSqlRequest,
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        deletesqlexecuteresponse::DeleteSqlExecuteResponse,
        deletesqlpreviewresponse::DeleteSqlPreviewResponse,
        updatesqlexecuteresponse::UpdateSqlExecuteResponse,
        updatesqlpreviewresponse::UpdateSqlPreviewResponse,
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
        if let Some(plan) = aggregate_fallback_plan(&stmt) {
            if plan.is_count_only() {
                let count_fetchxml = demote_count_fetchxml(&parsed.fetchxml)?;
                let total = query_engine
                    .retrieve_multiple_fetchxml_count(&parsed.entity_set, &count_fetchxml)
                    .await
                    .map_err(|error| {
                        println!("Error: {error}");
                        error
                    })?;

                let mut attributes = HashMap::new();
                attributes.insert(plan.aggregates[0].output.clone(), RowValue::Int(total as i64));
                attributes.insert(ROW_NUMBER_ATTRIBUTE.to_string(), RowValue::Int(1));
                ensure_columns(&mut attributes, &columns_order);

                (vec![ResultRow { attributes }], "Count retrieved.".to_string(), true)
            } else {
                let demoted_fetchxml = demote_aggregate_fetchxml(
                    &parsed.fetchxml,
                    &plan,
                )?;
                let resp = query_engine
                    .retrieve_multiple_fetchxml(&parsed.entity_set, &demoted_fetchxml)
                    .await
                    .map_err(|error| {
                        println!("Error: {error}");
                        error
                    })?;

                let rows = aggregate_rows(resp.value, &plan, &columns_order);
                (rows, resp.message, resp.success)
            }
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
pub async fn prepare_update_sql(
    _window: tauri::Window,
    sql: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<UpdateSqlPreviewResponse, String> {
    if matches!(context.log_level, LogLevel::Debug) {
        println!("SQL: {}", sql);
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

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();
    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);

    let (entity_set, entity_logical) = sql::resolve_entity_names(&stmt.entity);
    let primary_id_attribute =
        resolve_primary_id_attribute(&query_engine, &entity_logical, &entity_set).await?;

    if stmt
        .assignments
        .iter()
        .any(|assignment| normalize_ident(&assignment.column) == normalize_ident(&primary_id_attribute))
    {
        return Err("UPDATE cannot modify the primary ID attribute.".to_string());
    }

    let fetch = sql::update_to_fetchxml(&stmt, &primary_id_attribute)
        .map_err(|e| e.to_string())?;

    let entities = query_engine
        .retrieve_multiple_fetchxml(&fetch.entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            println!("Error: {error}");
            error
        })?;

    let mut ids: Vec<String> = Vec::new();
    for entity in entities.value {
        let value = entity
            .attributes
            .get(&primary_id_attribute)
            .ok_or_else(|| "Primary ID attribute missing from results".to_string())?;
        let id = value_to_string(value)
            .ok_or_else(|| "Primary ID attribute was null".to_string())?;
        ids.push(id);
    }

    let updates = build_update_attributes(
        &stmt.assignments,
        &stmt.entity,
        stmt.entity_alias.as_deref(),
    )?;

    let token = Uuid::new_v4().to_string();
    let batch = crate::UpdateBatch {
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
    _window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<UpdateSqlExecuteResponse, String> {
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

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();
    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);

    let mut updated = 0usize;
    let mut failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for id in &batch.ids {
        let result = query_engine
            .update_entity(&batch.entity_set, id, &batch.updates)
            .await;
        match result {
            Ok(_) => updated += 1,
            Err(error) => {
                failed += 1;
                errors.push(error);
            }
        }
    }

    let success = failed == 0;
    let message = if success {
        format!("Updated {} record(s).", updated)
    } else {
        format!("Updated {} record(s) with {} error(s).", updated, failed)
    };

    Ok(UpdateSqlExecuteResponse {
        success,
        message,
        updated,
        failed,
        errors,
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

#[tauri::command]
pub async fn prepare_delete_sql(
    _window: tauri::Window,
    sql: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<DeleteSqlPreviewResponse, String> {
    if matches!(context.log_level, LogLevel::Debug) {
        println!("SQL: {}", sql);
    }

    let stmt = sql::parse_delete(&sql).map_err(|e| e.to_string())?;

    if stmt.filter.is_none() {
        return Err("DELETE statements must include a WHERE clause.".to_string());
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

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();
    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);

    let (entity_set, entity_logical) = sql::resolve_entity_names(&stmt.entity);
    let primary_id_attribute =
        resolve_primary_id_attribute(&query_engine, &entity_logical, &entity_set).await?;

    let fetch = sql::delete_to_fetchxml(&stmt, &primary_id_attribute)
        .map_err(|e| e.to_string())?;

    let entities = query_engine
        .retrieve_multiple_fetchxml(&fetch.entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            println!("Error: {error}");
            error
        })?;

    let mut ids: Vec<String> = Vec::new();
    for entity in entities.value {
        let value = entity
            .attributes
            .get(&primary_id_attribute)
            .ok_or_else(|| "Primary ID attribute missing from results".to_string())?;
        let id = value_to_string(value)
            .ok_or_else(|| "Primary ID attribute was null".to_string())?;
        ids.push(id);
    }

    let token = Uuid::new_v4().to_string();
    let batch = crate::DeleteBatch {
        connection_id,
        entity_set,
        entity_logical,
        primary_id_attribute,
        ids,
    };
    let count = batch.ids.len();

    {
        let mut batches = database
            .delete_batches
            .lock()
            .map_err(|_| "Failed to lock delete state".to_string())?;
        batches.insert(token.clone(), batch);
    }

    Ok(DeleteSqlPreviewResponse {
        success: true,
        message: "Delete preview ready.".to_string(),
        count,
        token,
    })
}

#[tauri::command]
pub async fn execute_delete_sql(
    _window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<DeleteSqlExecuteResponse, String> {
    let batch = {
        let mut batches = database
            .delete_batches
            .lock()
            .map_err(|_| "Failed to lock delete state".to_string())?;
        batches
            .remove(&token)
            .ok_or_else(|| "Delete batch not found or expired.".to_string())?
    };

    let current_connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    if current_connection_id != batch.connection_id {
        return Err("Connection changed since preview; re-run the delete preview.".to_string());
    }

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| connection.id().as_ref() == Some(&current_connection_id))
        .ok_or("Connection not found")?;

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();
    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let query_engine = QueryEngine::new(&dataverse_url, &token, context.log_level);

    let mut deleted = 0usize;
    let mut failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for id in &batch.ids {
        let result = query_engine
            .delete_entity(&batch.entity_set, id)
            .await;
        match result {
            Ok(_) => deleted += 1,
            Err(error) => {
                failed += 1;
                errors.push(error);
            }
        }
    }

    let success = failed == 0;
    let message = if success {
        format!("Deleted {} record(s).", deleted)
    } else {
        format!("Deleted {} record(s) with {} error(s).", deleted, failed)
    };

    Ok(DeleteSqlExecuteResponse {
        success,
        message,
        deleted,
        failed,
        errors,
    })
}

#[tauri::command]
pub async fn discard_delete_sql(
    _window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
) -> Result<bool, String> {
    let mut batches = database
        .delete_batches
        .lock()
        .map_err(|_| "Failed to lock delete state".to_string())?;
    Ok(batches.remove(&token).is_some())
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

async fn resolve_primary_id_attribute(
    query_engine: &QueryEngine,
    entity_logical: &str,
    entity_set: &str,
) -> Result<String, String> {
    let definitions = query_engine.list_entity_definitions().await?;
    let target_logical = normalize_ident(entity_logical);
    let target_set = normalize_ident(entity_set);

    let matched = definitions.iter().find(|definition| {
        normalize_ident(&definition.logical_name) == target_logical
            || normalize_ident(&definition.schema_name) == target_logical
            || normalize_ident(&definition.entity_set_name) == target_logical
            || normalize_ident(&definition.entity_set_name) == target_set
    });

    Ok(matched
        .and_then(|definition| definition.primary_id_attribute.clone())
        .unwrap_or_else(|| format!("{}id", entity_logical)))
}

fn build_update_attributes(
    assignments: &[sql::UpdateAssignment],
    entity: &str,
    entity_alias: Option<&str>,
) -> Result<HashMap<String, JsonValue>, String> {
    let mut updates: HashMap<String, JsonValue> = HashMap::new();
    for assignment in assignments {
        let column = normalize_update_column(&assignment.column, entity, entity_alias);
        let value = literal_to_json(&assignment.value)?;
        updates.insert(column, value);
    }
    Ok(updates)
}

fn normalize_update_column(raw: &str, entity: &str, entity_alias: Option<&str>) -> String {
    if let Some((table, column)) = split_qualified(raw) {
        if let Some(table) = table {
            if table.eq_ignore_ascii_case(entity) {
                return column.to_string();
            }
            if let Some(alias) = entity_alias {
                if table.eq_ignore_ascii_case(alias) {
                    return column.to_string();
                }
            }
        }
    }
    raw.to_string()
}

fn split_qualified(value: &str) -> Option<(Option<&str>, &str)> {
    let mut parts = value.split('.');
    let first = parts.next()?;
    let second = parts.next();
    if let Some(second) = second {
        Some((Some(first), second))
    } else {
        Some((None, first))
    }
}

fn literal_to_json(literal: &sql::Literal) -> Result<JsonValue, String> {
    match literal {
        sql::Literal::String(value) => Ok(JsonValue::String(value.clone())),
        sql::Literal::Number(value) => Ok(JsonValue::Number((*value).into())),
        sql::Literal::Boolean(value) => Ok(JsonValue::Bool(*value)),
        sql::Literal::Null => Ok(JsonValue::Null),
    }
}

fn value_to_string(value: &RowValue) -> Option<String> {
    match value {
        RowValue::String(value) => Some(value.clone()),
        RowValue::Int(value) => Some(value.to_string()),
        RowValue::Float(value) => Some(value.to_string()),
        RowValue::Boolean(value) => Some(value.to_string()),
        RowValue::Null => None,
    }
}

fn normalize_ident(value: &str) -> String {
    value
        .trim_matches(|ch| ch == '[' || ch == ']' || ch == '"' || ch == '`')
        .to_ascii_lowercase()
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

fn demote_count_fetchxml(fetchxml: &str) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" aggregate=\"count\"", "");
    Ok(updated)
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

struct GroupColumn {
    source: std::string::String,
    output: std::string::String,
}

struct AggregateSpec {
    function: sql::AggregateFunction,
    target: Option<std::string::String>,
    output: std::string::String,
}

struct AggregatePlan {
    group_columns: Vec<GroupColumn>,
    aggregates: Vec<AggregateSpec>,
}

impl AggregatePlan {
    fn is_count_only(&self) -> bool {
        self.group_columns.is_empty()
            && self.aggregates.len() == 1
            && self.aggregates[0].function == sql::AggregateFunction::Count
    }

    fn required_columns(&self) -> Vec<std::string::String> {
        let mut columns: Vec<std::string::String> = self
            .group_columns
            .iter()
            .map(|column| column.source.clone())
            .collect();

        for aggregate in &self.aggregates {
            if let Some(target) = &aggregate.target {
                if !columns.contains(target) {
                    columns.push(target.clone());
                }
            }
        }

        columns
    }
}

fn aggregate_fallback_plan(stmt: &sql::SelectStmt) -> Option<AggregatePlan> {
    let items = match &stmt.columns {
        sql::SelectColumns::Columns(items) => items,
        _ => return None,
    };

    let has_aggregate = items.iter().any(|item| matches!(item.kind, sql::SelectItemKind::Aggregate(_)));
    if !has_aggregate {
        return None;
    }

    let mut group_columns: Vec<GroupColumn> = Vec::new();
    let mut aggregates: Vec<AggregateSpec> = Vec::new();

    for item in items {
        match &item.kind {
            sql::SelectItemKind::Attribute(name) => {
                let display = item.alias.clone().unwrap_or_else(|| name.clone());
                let matches_group = stmt.group_by.iter().any(|group| {
                    group == name || item.alias.as_ref().is_some_and(|alias| alias == group)
                });
                if !matches_group {
                    return None;
                }
                group_columns.push(GroupColumn {
                    source: name.clone(),
                    output: display,
                });
            }
            sql::SelectItemKind::Aggregate(aggregate) => {
                let output = aggregate_output_name(item);
                let target = match &aggregate.target {
                    sql::AggregateTarget::Star => None,
                    sql::AggregateTarget::Column(column) => Some(column.clone()),
                };
                aggregates.push(AggregateSpec {
                    function: aggregate.function,
                    target,
                    output,
                });
            }
        }
    }

    Some(AggregatePlan {
        group_columns,
        aggregates,
    })
}

fn aggregate_output_name(item: &sql::SelectItem) -> std::string::String {
    if let Some(alias) = &item.alias {
        return alias.clone();
    }

    match &item.kind {
        sql::SelectItemKind::Attribute(name) => name.clone(),
        sql::SelectItemKind::Aggregate(aggregate) => {
            let function = match aggregate.function {
                sql::AggregateFunction::Min => "min",
                sql::AggregateFunction::Max => "max",
                sql::AggregateFunction::Count => "count",
                sql::AggregateFunction::Sum => "sum",
                sql::AggregateFunction::Avg => "avg",
            };
            match &aggregate.target {
                sql::AggregateTarget::Star => function.to_string(),
                sql::AggregateTarget::Column(column) => format!("{}_{}", function, column),
            }
        }
    }
}

fn demote_aggregate_fetchxml(fetchxml: &str, plan: &AggregatePlan) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" groupby=\"true\"", "");
    updated = strip_aggregate_attributes(&updated)?;
    ensure_attributes(&updated, &plan.required_columns())
}

fn ensure_attributes(fetchxml: &str, columns: &[std::string::String]) -> Result<String, String> {
    if columns.is_empty() {
        return Ok(fetchxml.to_string());
    }

    let mut missing: Vec<std::string::String> = Vec::new();
    for column in columns {
        let needle_double = format!("name=\"{}\"", column);
        let needle_single = format!("name='{}'", column);
        if !fetchxml.contains(&needle_double) && !fetchxml.contains(&needle_single) {
            missing.push(column.clone());
        }
    }

    if missing.is_empty() {
        return Ok(fetchxml.to_string());
    }

    let entity_start = fetchxml
        .find("<entity")
        .ok_or_else(|| "FetchXML must contain an <entity> element".to_string())?;
    let entity_end = fetchxml[entity_start..]
        .find('>')
        .ok_or_else(|| "FetchXML <entity> element is not closed".to_string())?
        + entity_start;

    let mut inserted = std::string::String::new();
    inserted.push_str(&fetchxml[..=entity_end]);
    for column in missing {
        inserted.push_str("<attribute name=\"");
        inserted.push_str(&xml_escape(&column));
        inserted.push_str("\" />");
    }
    inserted.push_str(&fetchxml[entity_end + 1..]);
    Ok(inserted)
}

fn xml_escape(value: &str) -> std::string::String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn aggregate_rows(
    entities: Vec<Entity>,
    plan: &AggregatePlan,
    columns_order: &[String],
) -> Vec<ResultRow> {
    let mut groups: HashMap<Vec<std::string::String>, AggregateGroup> = HashMap::new();

    for entity in entities {
        let mut key_parts: Vec<std::string::String> = Vec::new();
        let mut group_values: HashMap<std::string::String, RowValue> = HashMap::new();

        for column in &plan.group_columns {
            let value = get_entity_value(&entity, &column.source);
            key_parts.push(value_key(&value));
            group_values.entry(column.output.clone()).or_insert(value);
        }

        let entry = groups
            .entry(key_parts)
            .or_insert_with(|| AggregateGroup::new(group_values, &plan.aggregates));

        entry.update(&entity);
    }

    let mut rows: Vec<ResultRow> = Vec::with_capacity(groups.len());
    let mut row_number = 1i64;
    for (_, group) in groups {
        let mut attributes = group.finalize();
        attributes.insert(ROW_NUMBER_ATTRIBUTE.to_string(), RowValue::Int(row_number));
        ensure_columns(&mut attributes, columns_order);
        rows.push(ResultRow { attributes });
        row_number += 1;
    }

    rows
}

struct AggregateAccumulator {
    output: std::string::String,
    function: sql::AggregateFunction,
    target: Option<std::string::String>,
    count: i64,
    sum: f64,
    sum_is_int: bool,
    min: Option<RowValue>,
    max: Option<RowValue>,
    numeric_count: i64,
}

impl AggregateAccumulator {
    fn new(spec: &AggregateSpec) -> Self {
        Self {
            output: spec.output.clone(),
            function: spec.function,
            target: spec.target.clone(),
            count: 0,
            sum: 0.0,
            sum_is_int: true,
            min: None,
            max: None,
            numeric_count: 0,
        }
    }

    fn update(&mut self, entity: &Entity) {
        match self.function {
            sql::AggregateFunction::Count => {
                if let Some(target) = &self.target {
                    let value = get_entity_value(entity, target);
                    if !matches!(value, RowValue::Null) {
                        self.count += 1;
                    }
                } else {
                    self.count += 1;
                }
            }
            sql::AggregateFunction::Sum | sql::AggregateFunction::Avg => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if let Some((num, is_int)) = numeric_value(&value) {
                    self.sum += num;
                    if !is_int {
                        self.sum_is_int = false;
                    }
                    self.numeric_count += 1;
                }
            }
            sql::AggregateFunction::Min => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if matches!(value, RowValue::Null) {
                    return;
                }
                if let Some(current) = &self.min {
                    if compare_values(&value, current).is_lt() {
                        self.min = Some(value);
                    }
                } else {
                    self.min = Some(value);
                }
            }
            sql::AggregateFunction::Max => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if matches!(value, RowValue::Null) {
                    return;
                }
                if let Some(current) = &self.max {
                    if compare_values(&value, current).is_gt() {
                        self.max = Some(value);
                    }
                } else {
                    self.max = Some(value);
                }
            }
        }
    }

    fn finalize(&self) -> RowValue {
        match self.function {
            sql::AggregateFunction::Count => RowValue::Int(self.count),
            sql::AggregateFunction::Sum => {
                if self.numeric_count == 0 {
                    RowValue::Null
                } else if self.sum_is_int {
                    RowValue::Int(self.sum as i64)
                } else {
                    RowValue::Float(self.sum)
                }
            }
            sql::AggregateFunction::Avg => {
                if self.numeric_count == 0 {
                    RowValue::Null
                } else {
                    RowValue::Float(self.sum / self.numeric_count as f64)
                }
            }
            sql::AggregateFunction::Min => self.min.clone().unwrap_or(RowValue::Null),
            sql::AggregateFunction::Max => self.max.clone().unwrap_or(RowValue::Null),
        }
    }
}

struct AggregateGroup {
    values: HashMap<std::string::String, RowValue>,
    accumulators: Vec<AggregateAccumulator>,
}

impl AggregateGroup {
    fn new(
        values: HashMap<std::string::String, RowValue>,
        specs: &[AggregateSpec],
    ) -> Self {
        Self {
            values,
            accumulators: specs.iter().map(AggregateAccumulator::new).collect(),
        }
    }

    fn update(&mut self, entity: &Entity) {
        for acc in self.accumulators.iter_mut() {
            acc.update(entity);
        }
    }

    fn finalize(mut self) -> HashMap<std::string::String, RowValue> {
        for acc in &self.accumulators {
            self.values.insert(acc.output.clone(), acc.finalize());
        }
        self.values
    }
}

fn get_entity_value(entity: &Entity, key: &str) -> RowValue {
    entity
        .attributes
        .get(key)
        .cloned()
        .unwrap_or(RowValue::Null)
}

fn numeric_value(value: &RowValue) -> Option<(f64, bool)> {
    match value {
        RowValue::Int(i) => Some((*i as f64, true)),
        RowValue::Float(f) => Some((*f, false)),
        _ => None,
    }
}

fn compare_values(left: &RowValue, right: &RowValue) -> std::cmp::Ordering {
    match (left, right) {
        (RowValue::Int(a), RowValue::Int(b)) => a.cmp(b),
        (RowValue::Int(a), RowValue::Float(b)) => (*a as f64).partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal),
        (RowValue::Float(a), RowValue::Int(b)) => a.partial_cmp(&(*b as f64)).unwrap_or(std::cmp::Ordering::Equal),
        (RowValue::Float(a), RowValue::Float(b)) => a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal),
        (RowValue::String(a), RowValue::String(b)) => a.cmp(b),
        (RowValue::Boolean(a), RowValue::Boolean(b)) => a.cmp(b),
        _ => value_key(left).cmp(&value_key(right)),
    }
}
