use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitSqlPart {
    pub index: usize,
    pub sql: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitSqlPartsResponse {
    pub count: usize,
    pub parts: Vec<SplitSqlPart>,
}
