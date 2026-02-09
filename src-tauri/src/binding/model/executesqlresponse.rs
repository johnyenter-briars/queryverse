use serde::{Deserialize, Serialize};

use crate::binding::model::resultrow::ResultRow;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlQueryMetadata {
    pub columns_selected: bool,
    pub columns_order: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSqlResponse {
    pub message: String,
    pub success: bool,
    pub value: Vec<ResultRow>,
    pub metadata: SqlQueryMetadata,
}
