use std::collections::HashMap;
use std::sync::Arc;

use powerplatform_dataverse_client::LogLevel;
use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;
use tauri::async_runtime::Mutex as AsyncMutex;

use crate::Database;
use crate::auth::config::auth_config_from_connection;
use crate::binding::model::connection::Connection;

pub async fn get_or_create_service_client(
    connection: &Connection,
    database: &Database,
    log_level: LogLevel,
) -> Result<Arc<ServiceClient>, String> {
    let connection_id = connection.id().ok_or("Connection missing id")?;
    let mut cache = database.service_clients.lock().await;
    if let Some(client) = cache.get(&connection_id) {
        return Ok(Arc::clone(client));
    }

    let auth = auth_config_from_connection(connection);
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
