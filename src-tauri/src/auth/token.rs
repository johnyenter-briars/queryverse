use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::{
    auth::credentials::{
        fetch_client_credentials_token_with_expiry, refresh_authorization_token,
    },
    binding::model::connection::Connection,
    Database,
};

const REFRESH_SKEW_SECS: u64 = 300;

#[derive(Clone, Debug)]
pub struct CachedToken {
    pub access_token: String,
    pub expires_at: Option<u64>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn is_expiring_soon(expires_at: Option<u64>) -> bool {
    let Some(exp) = expires_at else {
        return true;
    };
    now_secs() + REFRESH_SKEW_SECS >= exp
}

fn parse_expires_at(value: &str) -> Option<u64> {
    value.trim().parse::<u64>().ok()
}

fn cache_token(database: &Database, id: Uuid, token: CachedToken) -> Result<(), String> {
    let mut cache = database
        .token_cache
        .lock()
        .map_err(|_| "Failed to lock token cache".to_string())?;
    cache.insert(id, token);
    Ok(())
}

fn get_cached_token(database: &Database, id: Uuid) -> Result<Option<CachedToken>, String> {
    let cache = database
        .token_cache
        .lock()
        .map_err(|_| "Failed to lock token cache".to_string())?;
    Ok(cache.get(&id).cloned())
}

async fn refresh_token_for_connection(connection: &Connection) -> Result<CachedToken, String> {
    match connection {
        Connection::ClientCredentials {
            client_id,
            client_secret,
            tenant_id,
            scope,
            ..
        } => {
            let token = fetch_client_credentials_token_with_expiry(
                client_id,
                client_secret,
                tenant_id,
                scope,
            )
            .await?;
            Ok(CachedToken {
                access_token: token.access_token,
                expires_at: Some(token.expires_at),
            })
        }
        Connection::AuthorizationCode {
            client_id,
            client_secret,
            tenant_id,
            scope,
            refresh_token,
            ..
        } => {
            if client_id.trim().is_empty()
                || client_secret.trim().is_empty()
                || tenant_id.trim().is_empty()
                || scope.trim().is_empty()
            {
                return Err("Authorization code connection cannot refresh without client credentials."
                    .to_string());
            }

            let token = refresh_authorization_token(
                client_id,
                client_secret,
                tenant_id,
                scope,
                refresh_token,
            )
            .await?;
            Ok(CachedToken {
                access_token: token.access_token,
                expires_at: Some(token.expires_at),
            })
        }
    }
}

pub async fn prime_token_cache(connection: &Connection, database: &Database) -> Result<(), String> {
    let id = match connection {
        Connection::ClientCredentials { id, .. }
        | Connection::AuthorizationCode { id, .. } => id.clone(),
    }
    .ok_or("Connection missing id")?;

    let token = match connection {
        Connection::ClientCredentials { .. } => refresh_token_for_connection(connection).await?,
        Connection::AuthorizationCode {
            access_token,
            expires_at,
            ..
        } => {
            todo!("#11");
            let parsed_exp = parse_expires_at(expires_at);
            let cached = CachedToken {
                access_token: access_token.clone(),
                expires_at: parsed_exp,
            };

            if access_token.trim().is_empty() || is_expiring_soon(parsed_exp) {
                refresh_token_for_connection(connection).await?
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
    let id = match connection {
        Connection::ClientCredentials { id, .. }
        | Connection::AuthorizationCode { id, .. } => id.clone(),
    }
    .ok_or("Connection missing id")?;

    if let Some(cached) = get_cached_token(database, id)? {
        if !cached.access_token.trim().is_empty() && !is_expiring_soon(cached.expires_at) {
            println!("Valid token found");
            return Ok(cached.access_token);
        }
    }

    let refreshed = refresh_token_for_connection(connection).await?;
    let access_token = refreshed.access_token.clone();
    cache_token(database, id, refreshed)?;
    Ok(access_token)
}
