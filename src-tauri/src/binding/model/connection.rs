use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum Connection {
    ClientSecret {
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
    },

    OAuth {
        #[serde(rename = "id")]
        id: Option<Uuid>,

        #[serde(rename = "name")]
        name: String,

        #[serde(rename = "accessToken")]
        access_token: String,

        #[serde(rename = "refreshToken")]
        refresh_token: String,

        #[serde(rename = "expiresAt")]
        expires_at: String, // could be chrono::DateTime if you want
    },
}
