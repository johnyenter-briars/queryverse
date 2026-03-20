use serde::Serialize;

use super::{
    deletesqlexecuteresponse::DeleteSqlExecuteResponse,
    updatesqlexecuteresponse::UpdateSqlExecuteResponse,
};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundJobState {
    Running,
    Failed,
    Success,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundJobStatus {
    pub job_id: String,
    pub kind: String,
    pub state: BackgroundJobState,
    pub current_batch: usize,
    pub total_batches: usize,
    pub processed: usize,
    pub total: usize,
    pub message: String,
    pub result: Option<BackgroundJobResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundJobResult {
    Update(UpdateSqlExecuteResponse),
    Delete(DeleteSqlExecuteResponse),
}
