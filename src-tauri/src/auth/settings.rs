use std::fs;
use std::path::PathBuf;

use crate::binding::model::settings::Settings;

pub fn load_settings() -> Result<Settings, String> {
    let path = settings_path()?;

    if !path.exists() {
        return Ok(Settings::default());
    }

    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if contents.trim().is_empty() {
        return Ok(Settings::default());
    }

    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = settings_path()?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn settings_path() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or("Unable to resolve local app data directory")?;
    let dir = base.join("QueryVerse");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

