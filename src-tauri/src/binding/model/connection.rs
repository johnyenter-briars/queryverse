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
        #[serde(rename = "d365Url")]
        d365_url: String,

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

        #[serde(rename = "accessToken")]
        access_token: String,

        #[serde(rename = "refreshToken")]
        refresh_token: String,

        #[serde(rename = "expiresAt")]
        expires_at: String, // could be chrono::DateTime if you want

        #[serde(default)]
        #[serde(rename = "d365Url")]
        d365_url: String,

        #[serde(default)]
        #[serde(rename = "generatedOn")]
        generated_on: String,
    },
}
