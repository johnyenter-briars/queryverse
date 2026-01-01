use std::env;

use uuid::Uuid;

use crate::binding::model::{
    connection::Connection, createconnectionrequest::CreateConnectionRequest,
    createconnectionresponse::CreateConnectionResponse,
};

use crate::oauth::tokencache::TokenCache;

#[tauri::command]
pub async fn create_connection(
    _window: tauri::Window,
    _connection_request: CreateConnectionRequest,
) -> Result<CreateConnectionResponse, String> {
    let resp = CreateConnectionResponse::success(Connection::ClientSecret {
        client_id: "doo".to_string(),
        client_secret: "bar".to_string(),
        tenant_id: "baz".to_string(),
        id: Some(Uuid::new_v4()),
        name: "bar".to_string(),
    });

    println!("Getting token...");

    match env::current_dir() {
        Ok(path) => println!("Current working directory: {}", path.display()),
        Err(e) => eprintln!("Failed to get current directory: {}", e),
    }

    let token = TokenCache::get_token().await?;

    println!("Token: {}", token);

    Ok(resp)
}
