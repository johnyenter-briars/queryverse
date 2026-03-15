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

        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,

        #[serde(default)]
        #[serde(rename = "tokenCacheStorePath")]
        token_cache_store_path: Option<String>,
    },

    #[serde(rename = "DeviceCode", alias = "AuthorizationCode", alias = "OAuth")]
    DeviceCode {
        #[serde(rename = "name")]
        name: String,

        #[serde(rename = "clientId")]
        client_id: String,

        #[serde(rename = "tenantId")]
        tenant_id: String,

        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,

        #[serde(default)]
        #[serde(rename = "tokenCacheStorePath")]
        token_cache_store_path: Option<String>,
    },
}
