use uuid::Uuid;

use crate::binding::model::{
    connection::Connection, createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
};

#[tauri::command]
pub async fn create_connection(
    window: tauri::Window,
    connection_request: CreateConnectionRequest,
) -> Result<CreateConnectionResponse, String> {
    let response_result = reqwest::get("https://www.rust-lang.org").await;

    let name = match connection_request.value {
        Connection::ClientSecret { name, .. } => name,
        Connection::OAuth { name, .. } => name,
    };

    let resp = CreateConnectionResponse::success(Connection::ClientSecret {
        client_id: "doo".to_string(),
        client_secret: "bar".to_string(),
        tenant_id: "baz".to_string(),
        id: Some(Uuid::new_v4()),
        name,
    });

    return Ok(resp);
}
