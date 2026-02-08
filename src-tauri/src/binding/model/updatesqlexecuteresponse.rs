use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSqlExecuteResponse {
    pub success: bool,
    pub message: String,
    pub updated: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}
