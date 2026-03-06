use crate::{
    Database,
    auth::{connection::load_connections, token::get_access_token},
    binding::model::response::MultipleResponse,
};
use powerplatform_dataverse_client::dataverse::{
    entityattribute::EntityAttribute, entitydefinition::EntityDefinition,
    serviceclient::ServiceClient,
};

use super::helpers::normalize_ident;

pub(crate) async fn get_entity_definitions_cached(
    service_client: &ServiceClient,
    database: &Database,
    connection_id: Uuid,
) -> Result<Vec<EntityDefinition>, String> {
    {
        let cache = database
            .entity_definitions_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        if let Some(value) = cache.get(&connection_id) {
            return Ok(value.clone());
        }
    }

    let value = service_client.list_entity_definitions().await?;
    {
        let mut cache = database
            .entity_definitions_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.insert(connection_id, value.clone());
    }

    Ok(value)
}

pub(crate) async fn get_entity_attributes_cached(
    service_client: &ServiceClient,
    database: &Database,
    connection_id: Uuid,
    logical_name: &str,
    log_level: LogLevel,
) -> Result<Vec<EntityAttribute>, String> {
    let normalized = normalize_ident(logical_name);
    let key = (connection_id, normalized.clone());

    {
        let cache = database
            .entity_attributes_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        if let Some(value) = cache.get(&key) {
            if matches!(log_level, LogLevel::Debug) {
                println!(
                    "Set entity attributes for {} (cache hit).",
                    logical_name
                );
            }
            return Ok(value.clone());
        }
    }

    let value = service_client.list_entity_attributes(logical_name).await?;
    {
        let mut cache = database
            .entity_attributes_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.insert(key, value.clone());
    }

    if matches!(log_level, LogLevel::Debug) {
        println!(
            "Set entity attributes for {} (cache miss).",
            logical_name
        );
    }

    Ok(value)
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

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);
    let value = get_entity_definitions_cached(&service_client, &database, connection_id).await?;

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

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);
    let value = get_entity_attributes_cached(
        &service_client,
        &database,
        connection_id,
        &logical_name,
        context.log_level,
    )
    .await?;

    Ok(MultipleResponse {
        message: "Attributes retrieved.".to_string(),
        success: true,
        value,
    })
}
