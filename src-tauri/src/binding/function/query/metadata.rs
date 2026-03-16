use crate::{
    Database,
    auth::{connection::load_connections, serviceclient::get_or_create_service_client},
    binding::model::response::MultipleResponse,
};
use log::debug;
use powerplatform_dataverse_client::{
    LogLevel,
    dataverse::{
        entityattribute::EntityAttribute, entitydefinition::EntityDefinition,
        entityrelationship::EntityRelationship, serviceclient::ServiceClient,
    },
};
use uuid::Uuid;

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
    ensure_entity_metadata_cached(
        service_client,
        database,
        connection_id,
        logical_name,
        log_level,
    )
    .await?;

    let key = (connection_id, normalize_ident(logical_name));
    let cache = database
        .entity_attributes_cache
        .lock()
        .map_err(|_| "Failed to lock metadata cache".to_string())?;

    cache
        .get(&key)
        .cloned()
        .ok_or_else(|| format!("Attributes not cached for entity {}", logical_name))
}

pub(crate) async fn get_entity_relationships_cached(
    service_client: &ServiceClient,
    database: &Database,
    connection_id: Uuid,
    logical_name: &str,
    log_level: LogLevel,
) -> Result<Vec<EntityRelationship>, String> {
    ensure_entity_metadata_cached(
        service_client,
        database,
        connection_id,
        logical_name,
        log_level,
    )
    .await?;

    let key = (connection_id, normalize_ident(logical_name));
    let cache = database
        .entity_relationships_cache
        .lock()
        .map_err(|_| "Failed to lock metadata cache".to_string())?;

    cache
        .get(&key)
        .cloned()
        .ok_or_else(|| format!("Relationships not cached for entity {}", logical_name))
}

async fn ensure_entity_metadata_cached(
    service_client: &ServiceClient,
    database: &Database,
    connection_id: Uuid,
    logical_name: &str,
    log_level: LogLevel,
) -> Result<(), String> {
    let key = (connection_id, normalize_ident(logical_name));

    let attributes_cached = {
        let cache = database
            .entity_attributes_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.contains_key(&key)
    };

    let relationships_cached = {
        let cache = database
            .entity_relationships_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.contains_key(&key)
    };

    if attributes_cached && relationships_cached {
        if matches!(log_level, LogLevel::Debug) {
            debug!("Set entity metadata for {} (cache hit).", logical_name);
        }
        return Ok(());
    }

    let attributes = service_client.list_entity_attributes(logical_name).await?;
    let relationships = service_client.list_entity_relationships(logical_name).await?;

    {
        let mut cache = database
            .entity_attributes_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.insert(key.clone(), attributes);
    }

    {
        let mut cache = database
            .entity_relationships_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        cache.insert(key, relationships);
    }

    if matches!(log_level, LogLevel::Debug) {
        debug!("Set entity metadata for {} (cache miss).", logical_name);
    }

    Ok(())
}

#[tauri::command]
pub async fn list_entity_definitions(
    window: tauri::Window,
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

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;
    let value = get_entity_definitions_cached(&service_client, &database, connection_id).await?;

    Ok(MultipleResponse {
        message: "Metadata retrieved.".to_string(),
        success: true,
        value,
    })
}

#[tauri::command]
pub async fn list_entity_attributes(
    window: tauri::Window,
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

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;
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

#[tauri::command]
pub async fn list_entity_relationships(
    window: tauri::Window,
    logical_name: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<MultipleResponse<EntityRelationship>, String> {
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
    let value = get_entity_relationships_cached(
        &service_client,
        &database,
        connection_id,
        &logical_name,
        context.log_level,
    )
    .await?;

    Ok(MultipleResponse {
        message: "Relationships retrieved.".to_string(),
        success: true,
        value,
    })
}
