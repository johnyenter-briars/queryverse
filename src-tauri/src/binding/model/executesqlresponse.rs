use serde::{Deserialize, Serialize};

use crate::binding::model::resultrow::ResultRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlQueryMetadata {
    pub columns_selected: bool,
    pub columns_order: Vec<String>,
    pub entity_logical_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSqlResponse {
    pub message: String,
    pub success: bool,
    pub value: Vec<ResultRow>,
    pub metadata: SqlQueryMetadata,
}
