pub mod auth;
pub mod binding;
mod logging;
pub mod sql;

use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;

use crate::binding::function::{
    connection::{create_connection, list_connections, set_connection, update_connection},
    file::{open_sql_file, open_sql_file_path, save_sql_file, save_sql_file_as},
    launch::get_launch_context,
    logging::log_frontend,
    query::{
        discard_delete_sql, discard_update_sql, execute_delete_sql, execute_sql,
        execute_update_sql, list_entity_attributes, list_entity_definitions, parse_sql_to_fetchxml,
        prepare_delete_sql, prepare_update_sql,
    },
    settings::{get_settings, save_settings},
};
pub use powerplatform_dataverse_client::LogLevel;
use powerplatform_dataverse_client::auth::token::CachedToken;

pub struct Database {
    pub selected_connection_id: Mutex<Option<Uuid>>,
    pub token_cache: Mutex<HashMap<Uuid, CachedToken>>,
    pub entity_definitions_cache: Mutex<HashMap<Uuid, Vec<EntityDefinition>>>,
    pub entity_attributes_cache: Mutex<HashMap<(Uuid, String), Vec<EntityAttribute>>>,
    pub update_batches: Mutex<HashMap<String, UpdateBatch>>,
    pub delete_batches: Mutex<HashMap<String, DeleteBatch>>,
}

#[derive(Debug, Clone)]
pub struct UpdateBatch {
    pub connection_id: Uuid,
    pub entity_set: String,
    pub entity_logical: String,
    pub primary_id_attribute: String,
    pub ids: Vec<String>,
    pub updates: HashMap<String, JsonValue>,
}

#[derive(Debug, Clone)]
pub struct DeleteBatch {
    pub connection_id: Uuid,
    pub entity_set: String,
    pub entity_logical: String,
    pub primary_id_attribute: String,
    pub ids: Vec<String>,
}

#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchContext {
    pub sql_file_path: Option<String>,
    pub connection_name: Option<String>,
    pub log_level: LogLevel,
}

impl Default for Database {
    fn default() -> Self {
        Self {
            selected_connection_id: Mutex::new(None),
            token_cache: Mutex::new(HashMap::new()),
            entity_definitions_cache: Mutex::new(HashMap::new()),
            entity_attributes_cache: Mutex::new(HashMap::new()),
            update_batches: Mutex::new(HashMap::new()),
            delete_batches: Mutex::new(HashMap::new()),
        }
    }
}

fn parse_cli_args() -> LaunchContext {
    let mut sql_file_path = None;
    let mut connection_name = None;
    let mut log_level = LogLevel::Error;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--sql-file" {
            if let Some(value) = args.next() {
                sql_file_path = Some(value);
            }
            continue;
        }
        if let Some(value) = arg.strip_prefix("--sql-file=") {
            if !value.is_empty() {
                sql_file_path = Some(value.to_string());
            }
            continue;
        }
        if arg == "--connection" {
            if let Some(value) = args.next() {
                connection_name = Some(value);
            }
            continue;
        }
        if let Some(value) = arg.strip_prefix("--connection=") {
            if !value.is_empty() {
                connection_name = Some(value.to_string());
            }
            continue;
        }
        if arg == "--log-level" {
            if let Some(value) = args.next() {
                if let Some(parsed) = parse_log_level(&value) {
                    log_level = parsed;
                }
            }
            continue;
        }
        if let Some(value) = arg.strip_prefix("--log-level=") {
            if let Some(parsed) = parse_log_level(value) {
                log_level = parsed;
            }
            continue;
        }
    }

    LaunchContext {
        sql_file_path,
        connection_name,
        log_level,
    }
}

fn parse_log_level(value: &str) -> Option<LogLevel> {
    match value.trim().to_ascii_lowercase().as_str() {
        "error" => Some(LogLevel::Error),
        "warn" | "warning" => Some(LogLevel::Warn),
        "info" | "information" => Some(LogLevel::Information),
        "debug" => Some(LogLevel::Debug),
        "trace" => Some(LogLevel::Trace),
        _ => None,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_context = parse_cli_args();
    logging::init_logger(launch_context.log_level.as_filter())
        .expect("failed to initialize file logger");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(launch_context)
        .manage(Database::default())
        .invoke_handler(tauri::generate_handler![
            create_connection,
            list_connections,
            set_connection,
            update_connection,
            execute_sql,
            list_entity_attributes,
            list_entity_definitions,
            parse_sql_to_fetchxml,
            prepare_update_sql,
            execute_update_sql,
            discard_update_sql,
            prepare_delete_sql,
            execute_delete_sql,
            discard_delete_sql,
            get_launch_context,
            open_sql_file,
            open_sql_file_path,
            save_sql_file,
            save_sql_file_as,
            get_settings,
            save_settings,
            log_frontend
        ])
        .setup(|app| {
            let windows = app.webview_windows();
            let window = windows.get("QueryVerse").unwrap();
            window.open_devtools();
            window.close_devtools(); // Dev tools starts open but not steal focus
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
