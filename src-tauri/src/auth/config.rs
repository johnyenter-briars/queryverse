use powerplatform_dataverse_client::auth::config::AuthConfig;

use crate::binding::model::connection::Connection;

pub fn auth_config_from_connection(connection: &Connection) -> AuthConfig {
    connection.auth.clone()
}
