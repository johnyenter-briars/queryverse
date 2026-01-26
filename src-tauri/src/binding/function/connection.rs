use uuid::Uuid;

use crate::auth::connection::{load_connections, save_connection, save_connections, utc_timestamp};
use crate::auth::credentials::{exchange_authorization_code, validate_client_credentials};
use crate::auth::token::prime_token_cache;
use crate::binding::model::{
    connection::Connection,
    createconnectionpayload::CreateConnectionPayload,
    createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
    listconnectionsresponse::ListConnectionsResponse,
    setconnectionrequest::SetConnectionRequest,
    updateconnectionrequest::UpdateConnectionRequest,
    updateconnectionresponse::UpdateConnectionResponse,
};
use crate::Database;

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
            scope,
            d365_url,
        } => {
            validate_client_credentials(&client_id, &client_secret, &tenant_id, &scope).await?;

            Connection::ClientCredentials {
                id: Some(Uuid::new_v4()),
                name,
                client_id,
                client_secret,
                tenant_id,
                scope,
                d365_url,
                generated_on: utc_timestamp(),
            }
        }
        CreateConnectionPayload::AuthorizationCode {
            name,
            client_id,
            client_secret,
            tenant_id,
            scope,
            authorization_code,
            redirect_uri,
            username,
            password,
            d365_url,
        } => {
            todo!("#11");
            let token = exchange_authorization_code(
                &client_id,
                &client_secret,
                &tenant_id,
                &scope,
                &authorization_code,
                &redirect_uri,
                &username,
                &password,
            )
            .await?;

            Connection::AuthorizationCode {
                id: Some(Uuid::new_v4()),
                name,
                client_id,
                client_secret,
                tenant_id,
                scope,
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expires_at: token.expires_at.to_string(),
                d365_url,
                generated_on: utc_timestamp(),
            }
        }
    };

    save_connection(&connection)?;

    Ok(CreateConnectionResponse::validated(connection))
}

#[tauri::command]
pub async fn list_connections(_window: tauri::Window) -> Result<ListConnectionsResponse, String> {
    let connections = load_connections()?;
    Ok(ListConnectionsResponse::success(connections))
}

#[tauri::command]
pub async fn set_connection(
    _window: tauri::Window,
    request: SetConnectionRequest,
    database: tauri::State<'_, Database>,
) -> Result<(), String> {
    let connections = load_connections()?;
    let selected_connection = connections.iter().find(|connection| match connection {
        Connection::ClientCredentials { id, .. }
        | Connection::AuthorizationCode { id, .. } => id.as_ref() == Some(&request.connection_id),
    });

    let Some(selected_connection) = selected_connection else {
        return Err("Connection not found".to_string());
    };

    {
        let mut selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        *selected = Some(request.connection_id);
    }
    prime_token_cache(selected_connection, &database).await?;
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
            .position(|connection| match connection {
                Connection::ClientCredentials { id, .. }
                | Connection::AuthorizationCode { id, .. } => id.as_ref() == Some(&request_id),
            })
            .ok_or("Connection not found")?
    } else {
        if index >= connections.len() {
            return Err("Connection not found".to_string());
        }
        index
    };

    let existing_id = match &connections[target_index] {
        Connection::ClientCredentials { id, .. } | Connection::AuthorizationCode { id, .. } => id.clone(),
    };

    let updated_connection = match payload {
        CreateConnectionPayload::ClientCredentials {
            name,
            client_id,
            client_secret,
            tenant_id,
            scope,
            d365_url,
        } => {
            validate_client_credentials(&client_id, &client_secret, &tenant_id, &scope).await?;

            Connection::ClientCredentials {
                id: existing_id,
                name,
                client_id,
                client_secret,
                tenant_id,
                scope,
                d365_url,
                generated_on: utc_timestamp(),
            }
        }
        CreateConnectionPayload::AuthorizationCode {
            name,
            client_id,
            client_secret,
            tenant_id,
            scope,
            authorization_code,
            redirect_uri,
            username,
            password,
            d365_url,
        } => {
            todo!("#11");
            let token = exchange_authorization_code(
                &client_id,
                &client_secret,
                &tenant_id,
                &scope,
                &authorization_code,
                &redirect_uri,
                &username,
                &password,
            )
            .await?;

            Connection::AuthorizationCode {
                id: existing_id,
                name,
                client_id,
                client_secret,
                tenant_id,
                scope,
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expires_at: token.expires_at.to_string(),
                d365_url,
                generated_on: utc_timestamp(),
            }
        }
    };

    connections[target_index] = updated_connection.clone();
    save_connections(&connections)?;

    Ok(UpdateConnectionResponse {
        message: "Connection validated.".to_string(),
        success: true,
        value: updated_connection,
    })
}
