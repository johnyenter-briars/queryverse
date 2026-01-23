use std::fs;
use std::path::PathBuf;
use chrono::Utc;

use crate::binding::model::{
    connection::Connection,
};

pub fn load_connections() -> Result<Vec<Connection>, String> {
    let path = connections_path()?;

    if !path.exists() {
        return Ok(vec![]);
    }

    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    if contents.trim().is_empty() {
        return Ok(vec![]);
    }

    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

pub fn save_connection(connection: &Connection) -> Result<(), String> {
    let mut connections = load_connections()?;
    connections.push(connection.clone());
    save_connections(&connections)
}

pub fn save_connections(connections: &[Connection]) -> Result<(), String> {
    let path = connections_path()?;
    let json = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn connections_path() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or("Unable to resolve local app data directory")?;
    let dir = base.join("QueryVerse");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("connections.json"))
}

pub fn utc_timestamp() -> String {
    Utc::now().to_rfc3339()
}