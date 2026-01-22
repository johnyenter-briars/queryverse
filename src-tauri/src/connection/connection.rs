use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use reqwest::Client;
use serde_json::Value;
use uuid::Uuid;

use crate::binding::model::{
    connection::Connection,
    createconnectionpayload::CreateConnectionPayload,
    createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
    listconnectionsresponse::ListConnectionsResponse,
    updateconnectionrequest::UpdateConnectionRequest,
    updateconnectionresponse::UpdateConnectionResponse,
};

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
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expires_at: token.expires_at,
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
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expires_at: token.expires_at,
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

struct TokenExchange {
    access_token: String,
    refresh_token: String,
    expires_at: String,
}

async fn validate_client_credentials(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
) -> Result<(), String> {
    let client = Client::new();
    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("client_secret", client_secret);
    params.insert("scope", scope);
    params.insert("grant_type", "client_credentials");

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(body);
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in response")?;

    if access_token.trim().is_empty() {
        return Err("Access token was empty".to_string());
    }

    Ok(())
}

async fn exchange_authorization_code(
    client_id: &str,
    client_secret: &str,
    tenant_id: &str,
    scope: &str,
    authorization_code: &str,
    redirect_uri: &str,
    username: &str,
    password: &str,
) -> Result<TokenExchange, String> {
    let client = Client::new();
    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("client_secret", client_secret);
    params.insert("scope", scope);
    if authorization_code.trim().is_empty() {
        params.insert("grant_type", "password");
        params.insert("username", username);
        params.insert("password", password);
    } else {
        params.insert("grant_type", "authorization_code");
        params.insert("code", authorization_code);
        params.insert("redirect_uri", redirect_uri);
    }

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(body);
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;

    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in response")?
        .to_string();

    let refresh_token = json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or("No refresh_token in response")?
        .to_string();

    let expires_in = json
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .ok_or("No expires_in in response")?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let expires_at = now + expires_in;

    Ok(TokenExchange {
        access_token,
        refresh_token,
        expires_at: expires_at.to_string(),
    })
}

fn load_connections() -> Result<Vec<Connection>, String> {
    let path = connections_path()?;

    if !path.exists() {
        return Ok(vec![]);
    }

    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    if contents.trim().is_empty() {
        return Ok(vec![]);
    }

    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

fn save_connection(connection: &Connection) -> Result<(), String> {
    let mut connections = load_connections()?;
    connections.push(connection.clone());
    save_connections(&connections)
}

fn save_connections(connections: &[Connection]) -> Result<(), String> {
    let path = connections_path()?;
    let json = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn connections_path() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or("Unable to resolve local app data directory")?;
    let dir = base.join("QueryVerse");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("connections.json"))
}

fn utc_timestamp() -> String {
    Utc::now().to_rfc3339()
}
