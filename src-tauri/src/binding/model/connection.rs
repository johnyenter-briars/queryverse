use powerplatform_dataverse_client::auth::config::AuthConfig;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: Option<Uuid>,
    pub name: String,
    #[serde(default)]
    pub parent_folder_id: Option<Uuid>,
    pub auth: AuthConfig,
    #[serde(default)]
    pub generated_on: String,
}

impl Connection {
    pub fn id(&self) -> Option<Uuid> {
        self.id
    }

    pub fn dataverse_url(&self) -> &str {
        match &self.auth {
            AuthConfig::ClientCredentials { dataverse_url, .. } => dataverse_url,
            AuthConfig::DeviceCode { dataverse_url, .. } => dataverse_url,
        }
    }

    pub fn auth(&self) -> &AuthConfig {
        &self.auth
    }
}

#[cfg(test)]
mod tests {
    use super::Connection;
    use powerplatform_dataverse_client::auth::config::AuthConfig;
    use uuid::Uuid;

    #[test]
    fn accessors_return_stored_values() {
        let id = Uuid::new_v4();
        let auth = AuthConfig::DeviceCode {
            client_id: "client".to_string(),
            tenant_id: "tenant".to_string(),
            dataverse_url: "https://example.crm.dynamics.com".to_string(),
            token_cache_store_path: Some("cache.json".to_string()),
        };
        let connection = Connection {
            id: Some(id),
            name: "dev".to_string(),
            parent_folder_id: None,
            auth: auth.clone(),
            generated_on: String::new(),
        };

        assert_eq!(connection.id(), Some(id));
        assert_eq!(connection.dataverse_url(), "https://example.crm.dynamics.com");
        assert!(matches!(connection.auth(), AuthConfig::DeviceCode { .. }));
    }
}
