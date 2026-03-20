use crate::{
    Database,
    binding::model::{
        backgroundjobresultresponse::BackgroundJobResultResponse,
        backgroundjobstatusresponse::BackgroundJobStatusResponse,
    },
    jobs::{get_job, get_job_result},
};

#[tauri::command]
pub async fn get_background_job_status(
    _window: tauri::Window,
    job_id: String,
    database: tauri::State<'_, Database>,
) -> Result<BackgroundJobStatusResponse, String> {
    let job = get_job(&database.background_jobs, &job_id)
        .await
        .ok_or_else(|| "Background job not found.".to_string())?;

    Ok(BackgroundJobStatusResponse {
        success: true,
        message: "Background job status retrieved.".to_string(),
        value: job,
    })
}

#[tauri::command]
pub async fn get_background_job_result(
    _window: tauri::Window,
    job_id: String,
    database: tauri::State<'_, Database>,
) -> Result<BackgroundJobResultResponse, String> {
    let result = get_job_result(&database.background_job_results, &job_id)
        .await
        .ok_or_else(|| "Background job result not found.".to_string())?;

    Ok(BackgroundJobResultResponse {
        success: true,
        message: "Background job result retrieved.".to_string(),
        value: result,
    })
}
