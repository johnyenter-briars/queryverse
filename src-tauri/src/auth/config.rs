use powerplatform_dataverse_client::auth::token::{AuthConfig, parse_expires_at};

use crate::binding::model::connection::Connection;

pub fn auth_config_from_connection(connection: &Connection) -> AuthConfig {
    match connection {
        Connection::ClientCredentials {
            client_id,
            client_secret,
            tenant_id,
            scope,
            ..
        } => AuthConfig::ClientCredentials {
            client_id: client_id.clone(),
            client_secret: client_secret.clone(),
            tenant_id: tenant_id.clone(),
            scope: scope.clone(),
        },
        Connection::AuthorizationCode {
            client_id,
            client_secret,
            tenant_id,
            scope,
            access_token,
            refresh_token,
            expires_at,
            ..
        } => AuthConfig::AuthorizationCode {
            client_id: client_id.clone(),
            client_secret: client_secret.clone(),
            tenant_id: tenant_id.clone(),
            scope: scope.clone(),
            access_token: access_token.clone(),
            refresh_token: refresh_token.clone(),
            expires_at: parse_expires_at(expires_at),
        },
    }
}
