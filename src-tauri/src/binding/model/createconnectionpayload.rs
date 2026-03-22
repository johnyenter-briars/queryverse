use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum CreateConnectionPayload {
    #[serde(rename = "ClientCredentials", alias = "ClientSecret")]
    ClientCredentials {
        #[serde(default)]
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

        #[serde(rename = "dataverseUrl")]
        dataverse_url: String,

        #[serde(default)]
        #[serde(rename = "tokenCacheStorePath")]
        token_cache_store_path: Option<String>,

        #[serde(default)]
        #[serde(rename = "parentFolderId")]
        parent_folder_id: Option<Uuid>,
    },

    #[serde(rename = "DeviceCode", alias = "AuthorizationCode", alias = "OAuth")]
    DeviceCode {
        #[serde(default)]
        #[serde(rename = "id")]
        id: Option<Uuid>,

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

        #[serde(default)]
        #[serde(rename = "parentFolderId")]
        parent_folder_id: Option<Uuid>,
    },
}
