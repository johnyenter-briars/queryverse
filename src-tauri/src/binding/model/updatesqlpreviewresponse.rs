use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSqlPreviewResponse {
    pub success: bool,
    pub message: String,
    pub count: usize,
    pub token: String,
}
