use crate::{
    Database,
    binding::model::backgroundjobstatus::BackgroundJobResult,
    export::{csv::render_csv, excel::export_excel_not_implemented},
    jobs::get_job_result,
};

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

    let suggested_name = build_file_name(&job_id, "csv");
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
    _job_id: String,
    _database: tauri::State<'_, Database>,
) -> Result<Option<String>, String> {
    export_excel_not_implemented()
}

fn build_file_name(job_id: &str, extension: &str) -> String {
    let short_job_id = job_id.chars().take(8).collect::<String>();
    format!("queryverse-results-{short_job_id}.{extension}")
}
