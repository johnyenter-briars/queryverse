use log::error;
use uuid::Uuid;

use crate::Database;
use crate::auth::config::auth_config_from_connection;
use crate::auth::connection::{load_connections, save_connection, save_connections, utc_timestamp};
use crate::binding::model::{
    connection::Connection, createconnectionpayload::CreateConnectionPayload,
    createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
    listconnectionsresponse::ListConnectionsResponse, setconnectionrequest::SetConnectionRequest,
    updateconnectionrequest::UpdateConnectionRequest,
    updateconnectionresponse::UpdateConnectionResponse,
};
use powerplatform_dataverse_client::auth::config::AuthConfig;
use powerplatform_dataverse_client::{LogLevel, dataverse::serviceclient::ServiceClient};

#[tauri::command]
pub async fn create_connection(
    _window: tauri::Window,
    connection_request: CreateConnectionRequest,
) -> Result<CreateConnectionResponse, String> {
    let connection = match connection_request.value {
        CreateConnectionPayload::ClientCredentials {
            name,
            client_id,
            client_secret,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
        } => {
            let connection = Connection {
                id: Some(Uuid::new_v4()),
                name,
                auth: AuthConfig::ClientCredentials {
                    client_id,
                    client_secret,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            let auth = auth_config_from_connection(&connection);
            let _ = ServiceClient::new_with_auth(auth, LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("create_connection client credentials validation failed: {error}");
                    error
                })?;
            connection
        }
        CreateConnectionPayload::DeviceCode {
            name,
            client_id,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
        } => {
            let connection = Connection {
                id: Some(Uuid::new_v4()),
                name,
                auth: AuthConfig::DeviceCode {
                    client_id,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            let auth = auth_config_from_connection(&connection);
            let _ = ServiceClient::new_with_auth(auth, LogLevel::Error)
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
pub async fn list_connections(_window: tauri::Window) -> Result<ListConnectionsResponse, String> {
    let connections = load_connections()?;
    Ok(ListConnectionsResponse {
        message: "Connections found".to_string(),
        success: true,
        value: connections,
    })
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
    _window: tauri::Window,
    connection_request: UpdateConnectionRequest,
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
            name,
            client_id,
            client_secret,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
        } => {
            let connection = Connection {
                id: existing_id,
                name,
                auth: AuthConfig::ClientCredentials {
                    client_id,
                    client_secret,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            let auth = auth_config_from_connection(&connection);
            let _ = ServiceClient::new_with_auth(auth, LogLevel::Error)
                .await
                .map_err(|error| {
                    error!("update_connection client credentials validation failed: {error}");
                    error
                })?;
            connection
        }
        CreateConnectionPayload::DeviceCode {
            name,
            client_id,
            tenant_id,
            dataverse_url,
            token_cache_store_path,
        } => {
            let connection = Connection {
                id: existing_id,
                name,
                auth: AuthConfig::DeviceCode {
                    client_id,
                    tenant_id,
                    dataverse_url,
                    token_cache_store_path,
                },
                generated_on: utc_timestamp(),
            };
            let auth = auth_config_from_connection(&connection);
            let _ = ServiceClient::new_with_auth(auth, LogLevel::Error)
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

    Ok(UpdateConnectionResponse {
        message: "Connection validated.".to_string(),
        success: true,
        value: updated_connection,
    })
}
