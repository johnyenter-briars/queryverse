use uuid::Uuid;

use crate::binding::model::{
    connection::{Connection, ConnectionMethod}, createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
};

#[tauri::command]
pub async fn create_connection(
    window: tauri::Window,
    connection_request: CreateConnectionRequest,
) -> Result<CreateConnectionResponse, String> {
    let response_result = reqwest::get("https://www.rust-lang.org").await;

    let resp = CreateConnectionResponse::success(Connection {
        name: connection_request.value.name.to_string(),
        id: Some(Uuid::new_v4()),
        method: ConnectionMethod::ClientSecret,
    });

    return Ok(resp);
}
