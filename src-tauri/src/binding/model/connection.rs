use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum Connection {
    #[serde(rename = "ClientCredentials", alias = "ClientSecret")]
    ClientCredentials {
        #[serde(rename = "id")]
        id: Option<Uuid>,

        #[serde(rename = "name")]
        name: String,

        #[serde(rename = "clientId")]
        client_id: String,

        #[serde(rename = "clientSecret")]
        client_secret: String,

        #[serde(rename = "tenantId")]
        tenant_id: String,

        #[serde(default)]
        #[serde(rename = "scope")]
        scope: String,

        #[serde(default)]
        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,

        #[serde(default)]
        #[serde(rename = "generatedOn")]
        generated_on: String,
    },

    #[serde(rename = "AuthorizationCode", alias = "OAuth")]
    AuthorizationCode {
        #[serde(rename = "id")]
        id: Option<Uuid>,

        #[serde(rename = "name")]
        name: String,

        #[serde(default)]
        #[serde(rename = "clientId")]
        client_id: String,

        #[serde(default)]
        #[serde(rename = "clientSecret")]
        client_secret: String,

        #[serde(default)]
        #[serde(rename = "tenantId")]
        tenant_id: String,

        #[serde(default)]
        #[serde(rename = "scope")]
        scope: String,

        #[serde(rename = "accessToken")]
        access_token: String,

        #[serde(rename = "refreshToken")]
        refresh_token: String,

        #[serde(rename = "expiresAt")]
        expires_at: String, // could be chrono::DateTime if you want

        #[serde(default)]
        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,

        #[serde(default)]
        #[serde(rename = "generatedOn")]
        generated_on: String,
    },
}

impl Connection {
    pub fn id(&self) -> Option<Uuid> {
        match self {
            Connection::ClientCredentials { id, .. } | Connection::AuthorizationCode { id, .. } => {
                id.clone()
            }
        }
    }

    pub fn dataverse_url(&self) -> &String {
        match self {
            Connection::ClientCredentials { dataverse_url, .. }
            | Connection::AuthorizationCode { dataverse_url, .. } => dataverse_url,
        }
    }
}
