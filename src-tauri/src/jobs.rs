use std::{collections::HashMap, sync::Arc};

use tauri::async_runtime::Mutex as AsyncMutex;

use crate::binding::model::{
    backgroundjobstatus::{BackgroundJobResult, BackgroundJobState, BackgroundJobStatus},
    updatesqlexecuteresponse::UpdateSqlExecuteResponse,
};

pub type JobStore = Arc<AsyncMutex<HashMap<String, BackgroundJobStatus>>>;
pub type JobResultStore = Arc<AsyncMutex<HashMap<String, UpdateSqlExecuteResponse>>>;

pub fn create_job_store() -> JobStore {
    Arc::new(AsyncMutex::new(HashMap::new()))
}

pub fn create_job_result_store() -> JobResultStore {
    Arc::new(AsyncMutex::new(HashMap::new()))
}

pub async fn insert_job(job_store: &JobStore, job: BackgroundJobStatus) {
    job_store.lock().await.insert(job.job_id.clone(), job);
}

pub async fn get_job(job_store: &JobStore, job_id: &str) -> Option<BackgroundJobStatus> {
    job_store.lock().await.get(job_id).cloned()
}

pub async fn store_job_result_rows(
    job_result_store: &JobResultStore,
    job_id: &str,
    result: UpdateSqlExecuteResponse,
) {
    job_result_store
        .lock()
        .await
        .insert(job_id.to_string(), result);
}

pub async fn get_job_result(
    job_result_store: &JobResultStore,
    job_id: &str,
) -> Option<UpdateSqlExecuteResponse> {
    job_result_store.lock().await.get(job_id).cloned()
}

pub async fn update_job_progress(
    job_store: &JobStore,
    job_id: &str,
    state: BackgroundJobState,
    processed: usize,
    total: usize,
    message: String,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(job.state, BackgroundJobState::Success | BackgroundJobState::Failed) {
            return;
        }
        job.state = state;
        job.processed = processed;
        job.total = total;
        job.message = message;
    }
}

pub async fn complete_update_job(
    job_store: &JobStore,
    job_id: &str,
    response: UpdateSqlExecuteResponse,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        job.state = if response.success {
            BackgroundJobState::Success
        } else {
            BackgroundJobState::Failed
        };
        job.processed = response.updated + response.failed;
        job.total = response.updated + response.failed;
        job.message = response.message.clone();
        job.result = Some(BackgroundJobResult::Update(response));
    }
}

pub async fn fail_job(job_store: &JobStore, job_id: &str, processed: usize, total: usize, error: String) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        job.state = BackgroundJobState::Failed;
        job.processed = processed;
        job.total = total;
        job.message = error;
        job.result = None;
    }
}
