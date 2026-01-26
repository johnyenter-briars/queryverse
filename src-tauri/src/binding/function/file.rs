use std::path::Path;

use crate::binding::model::{
    opensqlfileresponse::OpenSqlFileResponse,
    savesqlfileasrequest::SaveSqlFileAsRequest,
    savesqlfileasresponse::SaveSqlFileAsResponse,
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
pub async fn open_sql_file_path(
    _window: tauri::Window,
    path: String,
) -> Result<OpenSqlFileResponse, String> {
    let contents = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("query.sql")
        .to_string();

    Ok(OpenSqlFileResponse {
        path,
        file_name,
        contents,
    })
}

#[tauri::command]
pub async fn save_sql_file(
    _window: tauri::Window,
    request: SaveSqlFileRequest,
) -> Result<(), String> {
    let path = Path::new(&request.path);
    std::fs::write(path, request.contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_sql_file_as(
    _window: tauri::Window,
    request: SaveSqlFileAsRequest,
) -> Result<Option<SaveSqlFileAsResponse>, String> {
    let mut dialog = rfd::FileDialog::new().add_filter("SQL", &["sql"]);
    if let Some(file_name) = request.file_name.as_deref() {
        if !file_name.trim().is_empty() {
            dialog = dialog.set_file_name(file_name);
        }
    }
    let file = dialog.save_file();

    let Some(path) = file else {
        return Ok(None);
    };

    std::fs::write(&path, request.contents).map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("query.sql")
        .to_string();

    Ok(Some(SaveSqlFileAsResponse {
        path: path.to_string_lossy().to_string(),
        file_name,
    }))
}
