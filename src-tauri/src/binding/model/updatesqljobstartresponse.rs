use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSqlJobStartResponse {
    pub success: bool,
    pub message: String,
    pub job_id: String,
}
