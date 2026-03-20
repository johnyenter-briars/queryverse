use crate::{
    Database,
    binding::model::backgroundjobstatusresponse::BackgroundJobStatusResponse,
    jobs::get_job,
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
