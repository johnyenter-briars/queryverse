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

#[cfg(test)]
mod tests {
    use super::{
        BackgroundJobResult, BackgroundJobState, BackgroundJobStatus, complete_select_job,
        create_job_result_store, create_job_store, fail_job, get_job, get_job_result, insert_job,
        request_job_cancellation, store_job_result_rows, update_job_progress,
    };
    use crate::binding::model::{
        executesqlresponse::{ExecuteSqlResponse, SqlQueryMetadata},
        resultrow::ResultRow,
    };

    fn make_job(state: BackgroundJobState) -> BackgroundJobStatus {
        BackgroundJobStatus {
            job_id: "job-1".to_string(),
            kind: "select".to_string(),
            state,
            current_batch: 0,
            total_batches: 3,
            processed: 0,
            total: 10,
            message: "queued".to_string(),
            result: None,
        }
    }

    fn make_select_response(rows: usize, success: bool, message: &str) -> ExecuteSqlResponse {
        ExecuteSqlResponse {
            message: message.to_string(),
            success,
            value: (0..rows).map(|_| ResultRow::new()).collect(),
            metadata: SqlQueryMetadata {
                columns_selected: true,
                columns_order: vec!["name".to_string()],
                entity_logical_name: Some("account".to_string()),
            },
        }
    }

    #[test]
    fn insert_and_get_job_round_trip() {
        tauri::async_runtime::block_on(async {
            let store = create_job_store();
            insert_job(&store, make_job(BackgroundJobState::Running)).await;

            let job = get_job(&store, "job-1").await.expect("job");
            assert_eq!(job.job_id, "job-1");
            assert_eq!(job.state, BackgroundJobState::Running);
        });
    }

    #[test]
    fn terminal_jobs_ignore_progress_updates() {
        tauri::async_runtime::block_on(async {
            let store = create_job_store();
            insert_job(&store, make_job(BackgroundJobState::Success)).await;

            update_job_progress(
                &store,
                "job-1",
                BackgroundJobState::Running,
                1,
                3,
                4,
                10,
                "updated".to_string(),
            )
            .await;

            let job = get_job(&store, "job-1").await.expect("job");
            assert_eq!(job.state, BackgroundJobState::Success);
            assert_eq!(job.message, "queued");
        });
    }

    #[test]
    fn cancellation_marks_running_job_and_clears_result() {
        tauri::async_runtime::block_on(async {
            let store = create_job_store();
            let mut job = make_job(BackgroundJobState::Running);
            job.result = Some(BackgroundJobResult::Select(make_select_response(1, true, "done")));
            insert_job(&store, job).await;

            let canceled = request_job_cancellation(&store, "job-1").await;
            let job = get_job(&store, "job-1").await.expect("job");

            assert!(canceled);
            assert_eq!(job.state, BackgroundJobState::Canceled);
            assert_eq!(job.message, "Job canceled.");
            assert!(job.result.is_none());
        });
    }

    #[test]
    fn complete_select_job_sets_terminal_state_and_result() {
        tauri::async_runtime::block_on(async {
            let store = create_job_store();
            insert_job(&store, make_job(BackgroundJobState::Running)).await;

            complete_select_job(&store, "job-1", make_select_response(2, true, "ok")).await;

            let job = get_job(&store, "job-1").await.expect("job");
            assert_eq!(job.state, BackgroundJobState::Success);
            assert_eq!(job.processed, 2);
            assert_eq!(job.total, 2);
            match job.result.expect("result") {
                BackgroundJobResult::Select(response) => assert_eq!(response.value.len(), 2),
                _ => panic!("expected select result"),
            }
        });
    }

    #[test]
    fn fail_job_does_not_override_canceled_state() {
        tauri::async_runtime::block_on(async {
            let store = create_job_store();
            insert_job(&store, make_job(BackgroundJobState::Canceled)).await;

            fail_job(&store, "job-1", 1, 3, 4, 10, "boom".to_string()).await;

            let job = get_job(&store, "job-1").await.expect("job");
            assert_eq!(job.state, BackgroundJobState::Canceled);
            assert_eq!(job.message, "queued");
        });
    }

    #[test]
    fn result_store_round_trip() {
        tauri::async_runtime::block_on(async {
            let store = create_job_result_store();
            let result = BackgroundJobResult::Select(make_select_response(1, true, "ok"));
            store_job_result_rows(&store, "job-1", result).await;

            let stored = get_job_result(&store, "job-1").await;
            assert!(matches!(stored, Some(BackgroundJobResult::Select(_))));
        });
    }
}
