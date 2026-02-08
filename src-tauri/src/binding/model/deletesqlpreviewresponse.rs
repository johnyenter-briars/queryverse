use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSqlPreviewResponse {
    pub success: bool,
    pub message: String,
    pub count: usize,
    pub token: String,
}
