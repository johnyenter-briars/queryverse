use powerplatform_dataverse_client::auth::config::AuthConfig;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: Option<Uuid>,
    pub name: String,
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
