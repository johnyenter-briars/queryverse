use std::{collections::HashMap, sync::Arc};

use tauri::async_runtime::Mutex as AsyncMutex;

use crate::binding::model::{
    backgroundjobstatus::{BackgroundJobResult, BackgroundJobState, BackgroundJobStatus},
    deletesqlexecuteresponse::DeleteSqlExecuteResponse,
    executesqlresponse::ExecuteSqlResponse,
    updatesqlexecuteresponse::UpdateSqlExecuteResponse,
};

pub type JobStore = Arc<AsyncMutex<HashMap<String, BackgroundJobStatus>>>;
pub type JobResultStore = Arc<AsyncMutex<HashMap<String, BackgroundJobResult>>>;

/// Create the shared in-memory progress store used by long-running background commands.
pub fn create_job_store() -> JobStore {
    Arc::new(AsyncMutex::new(HashMap::new()))
}

/// Create the shared in-memory result store that survives until the frontend fetches job output.
pub fn create_job_result_store() -> JobResultStore {
    Arc::new(AsyncMutex::new(HashMap::new()))
}

/// Insert or replace the current status record for a queued background job.
pub async fn insert_job(job_store: &JobStore, job: BackgroundJobStatus) {
    job_store.lock().await.insert(job.job_id.clone(), job);
}

pub async fn get_job(job_store: &JobStore, job_id: &str) -> Option<BackgroundJobStatus> {
    job_store.lock().await.get(job_id).cloned()
}

pub async fn store_job_result_rows(
    job_result_store: &JobResultStore,
    job_id: &str,
    result: BackgroundJobResult,
) {
    job_result_store
        .lock()
        .await
        .insert(job_id.to_string(), result);
}

pub async fn get_job_result(
    job_result_store: &JobResultStore,
    job_id: &str,
) -> Option<BackgroundJobResult> {
    job_result_store.lock().await.get(job_id).cloned()
}

/// Update observable job progress while preserving terminal states once they have been reached.
#[allow(clippy::too_many_arguments)]
pub async fn update_job_progress(
    job_store: &JobStore,
    job_id: &str,
    state: BackgroundJobState,
    current_batch: usize,
    total_batches: usize,
    processed: usize,
    total: usize,
    message: String,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        // Cancellation / failure / success are terminal from the UI's perspective. Workers may
        // still unwind after that, but we do not allow stale progress updates to resurrect the job.
        if matches!(
            job.state,
            BackgroundJobState::Success | BackgroundJobState::Failed | BackgroundJobState::Canceled
        ) {
            return;
        }
        job.state = state;
        job.current_batch = current_batch;
        job.total_batches = total_batches;
        job.processed = processed;
        job.total = total;
        job.message = message;
    }
}

/// Mark a running job as canceled. Workers poll this state and stop cooperatively.
pub async fn request_job_cancellation(job_store: &JobStore, job_id: &str) -> bool {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(
            job.state,
            BackgroundJobState::Success | BackgroundJobState::Failed | BackgroundJobState::Canceled
        ) {
            return false;
        }

        job.state = BackgroundJobState::Canceled;
        job.message = "Job canceled.".to_string();
        job.result = None;
        return true;
    }

    false
}

/// Finalize an update job once execution has completed and attach the response payload.
pub async fn complete_update_job(
    job_store: &JobStore,
    job_id: &str,
    response: UpdateSqlExecuteResponse,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(job.state, BackgroundJobState::Canceled) {
            return;
        }
        job.state = if response.success {
            BackgroundJobState::Success
        } else {
            BackgroundJobState::Failed
        };
        job.current_batch = job.total_batches;
        job.processed = response.updated + response.failed;
        job.total = response.updated + response.failed;
        job.message = response.message.clone();
        job.result = Some(BackgroundJobResult::Update(response));
    }
}

/// Finalize a select job once rows have been materialized and stored.
pub async fn complete_select_job(
    job_store: &JobStore,
    job_id: &str,
    response: ExecuteSqlResponse,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(job.state, BackgroundJobState::Canceled) {
            return;
        }
        job.state = if response.success {
            BackgroundJobState::Success
        } else {
            BackgroundJobState::Failed
        };
        job.current_batch = job.total_batches.max(job.current_batch);
        job.processed = response.value.len();
        job.total = response.value.len();
        job.message = response.message.clone();
        job.result = Some(BackgroundJobResult::Select(response));
    }
}

/// Finalize a delete job once execution has completed and attach the response payload.
pub async fn complete_delete_job(
    job_store: &JobStore,
    job_id: &str,
    response: DeleteSqlExecuteResponse,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(job.state, BackgroundJobState::Canceled) {
            return;
        }
        job.state = if response.success {
            BackgroundJobState::Success
        } else {
            BackgroundJobState::Failed
        };
        job.current_batch = job.total_batches;
        job.processed = response.deleted + response.failed;
        job.total = response.deleted + response.failed;
        job.message = response.message.clone();
        job.result = Some(BackgroundJobResult::Delete(response));
    }
}

/// Transition a running job into a failed terminal state with the last known progress snapshot.
pub async fn fail_job(
    job_store: &JobStore,
    job_id: &str,
    current_batch: usize,
    total_batches: usize,
    processed: usize,
    total: usize,
    error: String,
) {
    if let Some(job) = job_store.lock().await.get_mut(job_id) {
        if matches!(job.state, BackgroundJobState::Canceled) {
            return;
        }
        job.state = BackgroundJobState::Failed;
        job.current_batch = current_batch;
        job.total_batches = total_batches;
        job.processed = processed;
        job.total = total;
        job.message = error;
        job.result = None;
    }
}
