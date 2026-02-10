use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;
use uuid::Uuid;

use crate::{
    auth::{connection::load_connections, token::get_access_token},
    binding::model::{
        updatesqlexecuteresponse::UpdateSqlExecuteResponse,
        updatesqlpreviewresponse::UpdateSqlPreviewResponse,
    },
    sql, Database, LogLevel,
};

use super::helpers::{
    build_update_attributes, normalize_ident, resolve_primary_id_attribute, value_to_string,
};

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

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);

    let (entity_set, entity_logical) = sql::resolve_entity_names(&stmt.entity);
    let primary_id_attribute =
        resolve_primary_id_attribute(&service_client, &entity_logical, &entity_set).await?;

    if stmt
        .assignments
        .iter()
        .any(|assignment| normalize_ident(&assignment.column) == normalize_ident(&primary_id_attribute))
    {
        return Err("UPDATE cannot modify the primary ID attribute.".to_string());
    }

    let fetch = sql::update_to_fetchxml(&stmt, &primary_id_attribute)
        .map_err(|e| e.to_string())?;

    let entities = service_client
        .retrieve_multiple_fetchxml(&fetch.entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            println!("Error: {error}");
            error
        })?;

    let mut ids: Vec<String> = Vec::new();
    for entity in entities {
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

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);

    let mut updated = 0usize;
    let mut failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for id in &batch.ids {
        let result = service_client
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
