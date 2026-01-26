use std::path::Path;

use crate::binding::model::{
    opensqlfileresponse::OpenSqlFileResponse,
    savesqlfilerequest::SaveSqlFileRequest,
};

#[tauri::command]
pub async fn open_sql_file(_window: tauri::Window) -> Result<Option<OpenSqlFileResponse>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("SQL", &["sql"])
        .pick_file();

    let Some(path) = file else {
        return Ok(None);
    };

    let contents = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("query.sql")
        .to_string();
    let path = path.to_string_lossy().to_string();

    Ok(Some(OpenSqlFileResponse {
        path,
        file_name,
        contents,
    }))
}

#[tauri::command]
pub async fn save_sql_file(
    _window: tauri::Window,
    request: SaveSqlFileRequest,
) -> Result<(), String> {
    let path = Path::new(&request.path);
    std::fs::write(path, request.contents).map_err(|e| e.to_string())
}
