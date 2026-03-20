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
        updatesqlexecuteresponse::UpdateSqlExecuteResponse,
        updatesqlpreviewresponse::UpdateSqlPreviewResponse,
    },
    sql,
};

use super::helpers::{
    build_update_attributes, normalize_ident, resolve_primary_id_attribute,
    validate_update_attributes, value_to_string,
};
use super::metadata::{get_entity_attributes_cached, get_entity_definitions_cached};
use super::writebatch::{clamp_batch_size, execute_update_batches};

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

    let (updated, failed, errors) = execute_update_batches(
        &service_client,
        &batch,
        &request_parameters,
        clamp_batch_size(settings.dataverse_default_batch_size),
    )
    .await?;

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
