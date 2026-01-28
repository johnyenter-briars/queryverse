use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityAttribute {
    #[serde(rename = "LogicalName")]
    pub logical_name: String,
    #[serde(rename = "SchemaName")]
    pub schema_name: String,
    #[serde(rename = "AttributeType")]
    pub attribute_type: Option<String>,
    #[serde(rename = "IsCustomAttribute")]
    pub is_custom_attribute: Option<bool>,
    #[serde(rename = "IsValidODataAttribute")]
    pub is_valid_odata_attribute: Option<bool>,
    #[serde(rename = "IsValidForRead")]
    pub is_valid_for_read: Option<bool>,
}
