use log::{debug, error};
use powerplatform_dataverse_client::dataverse::requestparameters::RequestParameters;
use uuid::Uuid;

use crate::{
    Database,
    auth::{
        connection::load_connections, serviceclient::get_or_create_service_client,
        settings::load_settings,
    },
    binding::model::{
        deletesqlexecuteresponse::DeleteSqlExecuteResponse,
        deletesqlpreviewresponse::DeleteSqlPreviewResponse,
    },
    sql,
};

use super::helpers::{resolve_primary_id_attribute, value_to_string};
use super::metadata::get_entity_definitions_cached;

#[tauri::command]
pub async fn prepare_delete_sql(
    window: tauri::Window,
    sql: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<DeleteSqlPreviewResponse, String> {
    if context.log_level.includes_debug() {
        debug!("SQL: {}", sql);
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

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;

    let (entity_set, entity_logical) = sql::resolve_entity_names(&stmt.entity);
    let definitions =
        get_entity_definitions_cached(&service_client, &database, connection_id).await?;
    let primary_id_attribute =
        resolve_primary_id_attribute(&definitions, &entity_logical, &entity_set)?;

    let fetch = sql::delete_to_fetchxml(&stmt, &primary_id_attribute).map_err(|e| e.to_string())?;

    let entities = service_client
        .retrieve_multiple_fetchxml(&fetch.entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            error!("prepare_delete_sql retrieve_multiple_fetchxml failed: {error}");
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
    window: tauri::Window,
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

    let mut deleted = 0usize;
    let mut failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for id in &batch.ids {
        let result = service_client
            .delete_entity_with_options(&batch.entity_set, id, &request_parameters)
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
