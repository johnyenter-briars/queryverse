use log::error;
use std::collections::HashSet;
use uuid::Uuid;

use crate::Database;
use crate::auth::serviceclient::{ensure_device_code_auth, remove_service_client};
use crate::auth::connection::{
    folder_exists, get_default_connection as build_default_connection, load_connection_folders,
    load_connection_tree, load_connections, new_connection_folder, save_connection,
    save_connection_folder, save_connection_folders, save_connections, utc_timestamp,
};
use crate::binding::model::{
    connection::Connection, createconnectionpayload::CreateConnectionPayload,
    createconnectionfolderresponse::CreateConnectionFolderResponse,
    createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
    listconnectionsresponse::ListConnectionsResponse, listconnectiontreeresponse::ListConnectionTreeResponse,
    setconnectionrequest::SetConnectionRequest,
    updateconnectionrequest::UpdateConnectionRequest,
    updateconnectionfoldercolorresponse::UpdateConnectionFolderColorResponse,
    updateconnectionfolderresponse::UpdateConnectionFolderResponse,
    updateconnectionresponse::UpdateConnectionResponse,
};
use powerplatform_dataverse_client::auth::config::AuthConfig;
use powerplatform_dataverse_client::{LogLevel, dataverse::serviceclient::ServiceClient};

#[tauri::command]
pub async fn create_connection(
    window: tauri::Window,
    connection_request: CreateConnectionRequest,
) -> Result<CreateConnectionResponse, String> {
    let connection = match connection_request.value {
        CreateConnectionPayload::ClientCredentials {
            id,
            name,
            client_id,
            client_secret,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
            parent_folder_id,
        } => {
            validate_folder_parent(parent_folder_id)?;
            let connection = Connection {
                id: Some(id.unwrap_or_else(Uuid::new_v4)),
                name,
                parent_folder_id,
                auth: AuthConfig::ClientCredentials {
                    client_id,
                    client_secret,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            ensure_device_code_auth(&connection.auth, &window, connection.id()).await?;
            let _ = ServiceClient::new_with_auth(connection.auth.clone(), LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("create_connection client credentials validation failed: {error}");
                    error
                })?;
            connection
        }
        CreateConnectionPayload::DeviceCode {
            id,
            name,
            client_id,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
            parent_folder_id,
        } => {
            validate_folder_parent(parent_folder_id)?;
            let connection = Connection {
                id: Some(id.unwrap_or_else(Uuid::new_v4)),
                name,
                parent_folder_id,
                auth: AuthConfig::DeviceCode {
                    client_id,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            ensure_device_code_auth(&connection.auth, &window, connection.id()).await?;
            let _ = ServiceClient::new_with_auth(connection.auth.clone(), LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("create_connection device code validation failed: {error}");
                    error
                })?;
            connection
        }
    };

    save_connection(&connection).map_err(|error| {
        error!("create_connection save_connection failed: {error}");
        error
    })?;

    Ok(CreateConnectionResponse {
        message: "Connection validated.".to_string(),
        success: true,
        value: connection,
    })
}

#[tauri::command]
pub async fn get_default_connection(_window: tauri::Window) -> Result<Connection, String> {
    build_default_connection()
}

#[tauri::command]
pub async fn list_connections(_window: tauri::Window) -> Result<ListConnectionsResponse, String> {
    let connections = load_connections()?;
    Ok(ListConnectionsResponse {
        message: "Connections found".to_string(),
        success: true,
        value: connections,
    })
}

#[tauri::command]
pub async fn list_connection_tree(_window: tauri::Window) -> Result<ListConnectionTreeResponse, String> {
    Ok(ListConnectionTreeResponse {
        message: "Connection tree found".to_string(),
        success: true,
        value: load_connection_tree()?,
    })
}

#[tauri::command]
pub async fn create_connection_folder(
    _window: tauri::Window,
    name: String,
    parent_folder_id: Option<Uuid>,
) -> Result<CreateConnectionFolderResponse, String> {
    validate_folder_parent(parent_folder_id)?;
    let folder = new_connection_folder(name, parent_folder_id);
    save_connection_folder(&folder)?;
    Ok(CreateConnectionFolderResponse {
        message: "Folder created.".to_string(),
        success: true,
        value: folder,
    })
}

#[tauri::command]
pub async fn update_connection_folder_color(
    _window: tauri::Window,
    folder_id: Uuid,
    color: Option<String>,
) -> Result<UpdateConnectionFolderColorResponse, String> {
    let mut folders = load_connection_folders()?;
    let target_index = folders
        .iter_mut()
        .position(|folder| folder.id == folder_id)
        .ok_or("Folder not found".to_string())?;
    folders[target_index].color = color.filter(|value| !value.trim().is_empty());
    let updated_folder = folders[target_index].clone();
    save_connection_folders(&folders)?;
    Ok(UpdateConnectionFolderColorResponse {
        message: "Folder color updated.".to_string(),
        success: true,
        value: updated_folder,
    })
}

#[tauri::command]
pub async fn update_connection_folder(
    _window: tauri::Window,
    folder_id: Uuid,
    name: String,
    parent_folder_id: Option<Uuid>,
) -> Result<UpdateConnectionFolderResponse, String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Folder name is required.".to_string());
    }

    validate_folder_parent(parent_folder_id)?;

    let mut folders = load_connection_folders()?;
    let target_index = folders
        .iter()
        .position(|folder| folder.id == folder_id)
        .ok_or("Folder not found".to_string())?;

    if parent_folder_id == Some(folder_id) {
        return Err("Folder cannot be its own parent.".to_string());
    }

    let descendant_ids = collect_descendant_folder_ids(&folders, folder_id);
    if let Some(parent_id) = parent_folder_id
        && descendant_ids.contains(&parent_id)
    {
        return Err("Folder cannot be moved inside one of its descendants.".to_string());
    }

    folders[target_index].name = trimmed_name.to_string();
    folders[target_index].parent_folder_id = parent_folder_id;
    let updated_folder = folders[target_index].clone();

    save_connection_folders(&folders)?;

    Ok(UpdateConnectionFolderResponse {
        message: "Folder updated.".to_string(),
        success: true,
        value: updated_folder,
    })
}

#[tauri::command]
pub async fn delete_connection_folder(
    _window: tauri::Window,
    folder_id: Uuid,
) -> Result<bool, String> {
    let folders = load_connection_folders()?;
    if !folders.iter().any(|folder| folder.id == folder_id) {
        return Err("Folder not found".to_string());
    }

    let descendant_ids = collect_descendant_folder_ids(&folders, folder_id);
    let connections = load_connections()?;

    let remaining_folders: Vec<_> = folders
        .into_iter()
        .filter(|folder| !descendant_ids.contains(&folder.id))
        .collect();
    let remaining_connections: Vec<_> = connections
        .into_iter()
        .filter(|connection| {
            connection
                .parent_folder_id
                .map(|parent_id| !descendant_ids.contains(&parent_id))
                .unwrap_or(true)
        })
        .collect();

    save_connection_folders(&remaining_folders)?;
    save_connections(&remaining_connections)?;

    Ok(true)
}

#[tauri::command]
pub async fn delete_connection(
    _window: tauri::Window,
    connection_id: Uuid,
    database: tauri::State<'_, Database>,
) -> Result<bool, String> {
    let mut connections = load_connections()?;
    let target_index = connections
        .iter()
        .position(|connection| connection.id() == Some(connection_id))
        .ok_or("Connection not found".to_string())?;

    connections.remove(target_index);
    save_connections(&connections)?;

    remove_service_client(connection_id, &database.service_clients).await?;

    {
        let mut selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        if *selected == Some(connection_id) {
            *selected = None;
        }
    }

    {
        let mut definitions = database
            .entity_definitions_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        definitions.remove(&connection_id);
    }

    {
        let mut attributes = database
            .entity_attributes_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        attributes.retain(|(cached_connection_id, _), _| *cached_connection_id != connection_id);
    }

    {
        let mut relationships = database
            .entity_relationships_cache
            .lock()
            .map_err(|_| "Failed to lock metadata cache".to_string())?;
        relationships
            .retain(|(cached_connection_id, _), _| *cached_connection_id != connection_id);
    }

    Ok(true)
}

#[tauri::command]
pub async fn set_connection(
    _window: tauri::Window,
    request: SetConnectionRequest,
    database: tauri::State<'_, Database>,
) -> Result<(), String> {
    let connections = load_connections()?;
    let selected_connection = connections
        .iter()
        .find(|connection| connection.id().as_ref() == Some(&request.connection_id));

    let Some(_selected_connection) = selected_connection else {
        return Err("Connection not found".to_string());
    };

    {
        let mut selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        *selected = Some(request.connection_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn update_connection(
    window: tauri::Window,
    connection_request: UpdateConnectionRequest,
    database: tauri::State<'_, Database>,
) -> Result<UpdateConnectionResponse, String> {
    let UpdateConnectionRequest { id, index, payload } = connection_request;
    let mut connections = load_connections()?;

    let target_index = if let Some(request_id) = id {
        connections
            .iter()
            .position(|connection| connection.id().as_ref() == Some(&request_id))
            .ok_or("Connection not found")?
    } else {
        if index >= connections.len() {
            return Err("Connection not found".to_string());
        }
        index
    };

    let existing_id = connections[target_index].id();

    let updated_connection = match payload {
        CreateConnectionPayload::ClientCredentials {
            id: _,
            name,
            client_id,
            client_secret,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
            parent_folder_id,
        } => {
            validate_folder_parent(parent_folder_id)?;
            let connection = Connection {
                id: existing_id,
                name,
                parent_folder_id,
                auth: AuthConfig::ClientCredentials {
                    client_id,
                    client_secret,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            ensure_device_code_auth(&connection.auth, &window, connection.id()).await?;
            let _ = ServiceClient::new_with_auth(connection.auth.clone(), LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("update_connection client credentials validation failed: {error}");
                    error
                })?;
            connection
        }
        CreateConnectionPayload::DeviceCode {
            id: _,
            name,
            client_id,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
            parent_folder_id,
        } => {
            validate_folder_parent(parent_folder_id)?;
            let connection = Connection {
                id: existing_id,
                name,
                parent_folder_id,
                auth: AuthConfig::DeviceCode {
                    client_id,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            ensure_device_code_auth(&connection.auth, &window, connection.id()).await?;
            let _ = ServiceClient::new_with_auth(connection.auth.clone(), LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("update_connection device code validation failed: {error}");
                    error
                })?;
            connection
        }
    };

    connections[target_index] = updated_connection.clone();
    save_connections(&connections).map_err(|error| {
        error!("update_connection save_connections failed: {error}");
        error
    })?;

    if let Some(connection_id) = updated_connection.id() {
        remove_service_client(connection_id, &database.service_clients).await?;

        {
            let mut definitions = database
                .entity_definitions_cache
                .lock()
                .map_err(|_| "Failed to lock metadata cache".to_string())?;
            definitions.remove(&connection_id);
        }

        {
            let mut attributes = database
                .entity_attributes_cache
                .lock()
                .map_err(|_| "Failed to lock metadata cache".to_string())?;
            attributes.retain(|(cached_connection_id, _), _| *cached_connection_id != connection_id);
        }

        {
            let mut relationships = database
                .entity_relationships_cache
                .lock()
                .map_err(|_| "Failed to lock metadata cache".to_string())?;
            relationships
                .retain(|(cached_connection_id, _), _| *cached_connection_id != connection_id);
        }
    }

    Ok(UpdateConnectionResponse {
        message: "Connection validated.".to_string(),
        success: true,
        value: updated_connection,
    })
}

fn validate_folder_parent(parent_folder_id: Option<Uuid>) -> Result<(), String> {
    if let Some(folder_id) = parent_folder_id
        && !folder_exists(folder_id)?
    {
        return Err("Parent folder not found".to_string());
    }

    Ok(())
}

fn collect_descendant_folder_ids(folders: &[crate::binding::model::connectionfolder::ConnectionFolder], root_id: Uuid) -> HashSet<Uuid> {
    let mut ids = HashSet::new();
    let mut stack = vec![root_id];

    while let Some(current_id) = stack.pop() {
        if !ids.insert(current_id) {
            continue;
        }

        for child in folders
            .iter()
            .filter(|folder| folder.parent_folder_id == Some(current_id))
        {
            stack.push(child.id);
        }
    }

    ids
}
