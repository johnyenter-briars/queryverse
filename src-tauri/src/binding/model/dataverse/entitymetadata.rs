use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct EntityMetadata {
    #[serde(rename = "@odata.context")]
    pub odata_context: Option<String>,
    #[serde(rename = "LogicalName")]
    pub logical_name: Option<String>,
    #[serde(rename = "PrimaryIdAttribute")]
    pub primary_id_attribute: String,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}
