use log::Level;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLogRequest {
    pub level: String,
    pub message: String,
    pub source: Option<String>,
}

#[tauri::command]
pub async fn log_frontend(
    _window: tauri::Window,
    request: FrontendLogRequest,
) -> Result<(), String> {
    let level = parse_frontend_level(&request.level);
    let target = request
        .source
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("queryverse::frontend");

    log::log!(target: target, level, "{}", request.message);
    Ok(())
}

fn parse_frontend_level(level: &str) -> Level {
    match level.trim().to_ascii_lowercase().as_str() {
        "error" => Level::Error,
        "warn" | "warning" => Level::Warn,
        "info" | "information" => Level::Info,
        "debug" => Level::Debug,
        "trace" => Level::Trace,
        _ => Level::Info,
    }
}
