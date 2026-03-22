use crate::{
    Database,
    binding::model::{backgroundjobstatus::BackgroundJobResult, executesqlresponse::ExecuteSqlResponse},
    export::{csv::render_csv, excel::build_excel_bytes},
    jobs::get_job_result,
};
use chrono::Local;

#[tauri::command]
pub async fn export_csv(
    _window: tauri::Window,
    job_id: String,
    database: tauri::State<'_, Database>,
) -> Result<Option<String>, String> {
    let result = get_job_result(&database.background_job_results, &job_id)
        .await
        .ok_or_else(|| "Background job result not found.".to_string())?;

    let BackgroundJobResult::Select(select_result) = result else {
        return Err("CSV export is only supported for select results.".to_string());
    };

    let suggested_name = build_file_name(&select_result, "csv");
    let file = rfd::FileDialog::new()
        .add_filter("CSV", &["csv"])
        .set_file_name(&suggested_name)
        .save_file();

    let Some(path) = file else {
        return Ok(None);
    };

    let csv = render_csv(&select_result);
    std::fs::write(&path, csv).map_err(|error| error.to_string())?;

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn export_excel(
    _window: tauri::Window,
    job_id: String,
    database: tauri::State<'_, Database>,
) -> Result<Option<String>, String> {
    let result = get_job_result(&database.background_job_results, &job_id)
        .await
        .ok_or_else(|| "Background job result not found.".to_string())?;

    let BackgroundJobResult::Select(select_result) = result else {
        return Err("Excel export is only supported for select results.".to_string());
    };

    let suggested_name = build_file_name(&select_result, "xlsx");
    let file = rfd::FileDialog::new()
        .add_filter("Excel", &["xlsx"])
        .set_file_name(&suggested_name)
        .save_file();

    let Some(path) = file else {
        return Ok(None);
    };

    let bytes = build_excel_bytes(&select_result)?;
    std::fs::write(&path, bytes).map_err(|error| error.to_string())?;

    Ok(Some(path.to_string_lossy().to_string()))
}

fn build_file_name(result: &ExecuteSqlResponse, extension: &str) -> String {
    let table_name = result
        .metadata
        .entity_logical_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("results");
    let timestamp = Local::now().format("%Y-%m-%d-%H-%M-%S");
    format!("results_{table_name}_{timestamp}.{extension}")
}
