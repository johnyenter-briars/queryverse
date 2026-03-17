use std::collections::HashMap;
use std::sync::Arc;

use powerplatform_dataverse_client::auth::config::AuthConfig;
use powerplatform_dataverse_client::auth::devicecode::{
    DeviceCodeFlowEvent, ensure_device_code_token_with_progress,
};
use powerplatform_dataverse_client::LogLevel;
use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;
use tauri::Emitter;
use tauri::async_runtime::Mutex as AsyncMutex;

use crate::Database;
use crate::auth::config::auth_config_from_connection;
use crate::binding::model::connection::Connection;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceCodeAuthEventPayload {
    stage: String,
    connection_id: Option<String>,
    verification_uri: Option<String>,
    verification_uri_complete: Option<String>,
    user_code: Option<String>,
    message: Option<String>,
}

fn emit_device_code_auth_event(
    window: &tauri::Window,
    connection_id: Option<uuid::Uuid>,
    event: DeviceCodeFlowEvent,
) {
    let payload = match event {
        DeviceCodeFlowEvent::Code {
            verification_uri,
            verification_uri_complete,
            user_code,
            message,
        } => DeviceCodeAuthEventPayload {
            stage: "code".to_string(),
            connection_id: connection_id.map(|value| value.to_string()),
            verification_uri: Some(verification_uri),
            verification_uri_complete,
            user_code: Some(user_code),
            message,
        },
        DeviceCodeFlowEvent::Waiting => DeviceCodeAuthEventPayload {
            stage: "waiting".to_string(),
            connection_id: connection_id.map(|value| value.to_string()),
            verification_uri: None,
            verification_uri_complete: None,
            user_code: None,
            message: Some("Waiting for sign-in in the browser...".to_string()),
        },
        DeviceCodeFlowEvent::Success => DeviceCodeAuthEventPayload {
            stage: "success".to_string(),
            connection_id: connection_id.map(|value| value.to_string()),
            verification_uri: None,
            verification_uri_complete: None,
            user_code: None,
            message: Some("Device code authentication completed.".to_string()),
        },
    };

    let _ = window.emit("device-code-auth", payload);
}

pub async fn ensure_device_code_auth(
    auth: &AuthConfig,
    window: &tauri::Window,
    connection_id: Option<uuid::Uuid>,
) -> Result<(), String> {
    if !matches!(auth, AuthConfig::DeviceCode { .. }) {
        return Ok(());
    }

    ensure_device_code_token_with_progress(auth, |event| {
        emit_device_code_auth_event(window, connection_id, event);
    })
    .await
}

pub async fn get_or_create_service_client(
    connection: &Connection,
    database: &Database,
    log_level: LogLevel,
    window: Option<&tauri::Window>,
) -> Result<Arc<ServiceClient>, String> {
    let connection_id = connection.id().ok_or("Connection missing id")?;
    let mut cache = database.service_clients.lock().await;
    if let Some(client) = cache.get(&connection_id) {
        return Ok(Arc::clone(client));
    }

    let auth = auth_config_from_connection(connection);
    if let Some(window) = window {
        ensure_device_code_auth(&auth, window, Some(connection_id)).await?;
    }
    let service_client = Arc::new(ServiceClient::new_with_auth(auth, log_level).await?);
    cache.insert(connection_id, Arc::clone(&service_client));
    Ok(service_client)
}

pub async fn remove_service_client(
    connection_id: uuid::Uuid,
    cache: &AsyncMutex<HashMap<uuid::Uuid, Arc<ServiceClient>>>,
) -> Result<(), String> {
    let mut clients = cache.lock().await;
    clients.remove(&connection_id);
    Ok(())
}
