use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum CreateConnectionPayload {
    #[serde(rename = "ClientCredentials", alias = "ClientSecret")]
    ClientCredentials {
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

        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,
    },

    #[serde(rename = "AuthorizationCode", alias = "OAuth")]
    AuthorizationCode {
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

        #[serde(rename = "username")]
        username: String,

        #[serde(rename = "password")]
        password: String,

        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,
    },
}
