use powerplatform_dataverse_client::auth::token::{
    fetch_token, is_expiring_soon, AuthConfig, CachedToken,
};

use crate::auth::config::auth_config_from_connection;
use crate::binding::model::connection::Connection;
use crate::Database;

fn cache_token(database: &Database, id: uuid::Uuid, token: CachedToken) -> Result<(), String> {
    let mut cache = database
        .token_cache
        .lock()
        .map_err(|_| "Failed to lock token cache".to_string())?;
    cache.insert(id, token);
    Ok(())
}

fn get_cached_token(database: &Database, id: uuid::Uuid) -> Result<Option<CachedToken>, String> {
    let cache = database
        .token_cache
        .lock()
        .map_err(|_| "Failed to lock token cache".to_string())?;

    Ok(cache.get(&id).cloned())
}

pub async fn prime_token_cache(connection: &Connection, database: &Database) -> Result<(), String> {
    let id = connection.id().ok_or("Connection missing id")?;
    let auth = auth_config_from_connection(connection);

    let token = match &auth {
        AuthConfig::ClientCredentials { .. } => fetch_token(&auth).await?,
        AuthConfig::AuthorizationCode {
            access_token,
            expires_at,
            ..
        } => {
            todo!("#11");
            let cached = CachedToken {
                access_token: access_token.clone(),
                expires_at: *expires_at,
            };

            if access_token.trim().is_empty() || is_expiring_soon(*expires_at) {
                fetch_token(&auth).await?
            } else {
                cached
            }
        }
    };

    cache_token(database, id, token)
}

pub async fn get_access_token(
    connection: &Connection,
    database: &Database,
) -> Result<String, String> {
    let id = connection.id().ok_or("Connection missing id")?;

    if let Some(cached) = get_cached_token(database, id)? {
        if !cached.access_token.trim().is_empty() && !is_expiring_soon(cached.expires_at) {
            println!("Valid token found. Connection: {:?}", connection.id());
            return Ok(cached.access_token);
        }
    }

    let auth = auth_config_from_connection(connection);
    let refreshed = fetch_token(&auth).await?;
    let access_token = refreshed.access_token.clone();
    cache_token(database, id, refreshed)?;
    Ok(access_token)
}
