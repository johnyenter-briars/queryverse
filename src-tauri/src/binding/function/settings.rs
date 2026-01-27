use crate::auth::settings::{load_settings, save_settings as persist_settings};
use crate::binding::model::{settings::Settings, settingsresponse::SettingsResponse};

#[tauri::command]
pub async fn get_settings(_window: tauri::Window) -> Result<SettingsResponse, String> {
    let settings = load_settings()?;
    Ok(SettingsResponse::success(settings))
}

#[tauri::command]
pub async fn save_settings(
    _window: tauri::Window,
    settings: Settings,
) -> Result<SettingsResponse, String> {
    persist_settings(&settings)?;
    Ok(SettingsResponse::success(settings))
}

