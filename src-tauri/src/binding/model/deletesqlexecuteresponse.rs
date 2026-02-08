use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSqlExecuteResponse {
    pub success: bool,
    pub message: String,
    pub deleted: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}
