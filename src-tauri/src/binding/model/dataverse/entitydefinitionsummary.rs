use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityDefinitionSummary {
    #[serde(rename = "LogicalName")]
    pub logical_name: String,
    #[serde(rename = "SchemaName")]
    pub schema_name: String,
    #[serde(rename = "DisplayName")]
    pub display_name: Option<Value>,
    #[serde(rename = "EntitySetName")]
    pub entity_set_name: String,
    #[serde(rename = "IsCustomEntity")]
    pub is_custom_entity: bool,
}
