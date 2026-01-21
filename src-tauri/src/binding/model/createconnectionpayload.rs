use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum CreateConnectionPayload {
    ClientSecret {
        #[serde(rename = "name")]
        name: String,

        #[serde(rename = "clientId")]
        client_id: String,

        #[serde(rename = "clientSecret")]
        client_secret: String,

        #[serde(rename = "tenantId")]
        tenant_id: String,

        #[serde(rename = "scope")]
        scope: String,
    },

    OAuth {
        #[serde(rename = "name")]
        name: String,

        #[serde(rename = "clientId")]
        client_id: String,

        #[serde(rename = "clientSecret")]
        client_secret: String,

        #[serde(rename = "tenantId")]
        tenant_id: String,

        #[serde(rename = "scope")]
        scope: String,

        #[serde(rename = "authorizationCode")]
        authorization_code: String,

        #[serde(rename = "redirectUri")]
        redirect_uri: String,
    },
}
