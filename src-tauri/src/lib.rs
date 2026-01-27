pub mod binding;
pub mod dataverse;
pub mod auth;
pub mod sql;

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;

use crate::binding::function::{
    connection::{create_connection, list_connections, set_connection, update_connection},
    file::{open_sql_file, open_sql_file_path, save_sql_file, save_sql_file_as},
    launch::get_launch_context,
    query::{execute_sql, list_entity_definitions, parse_sql_to_fetchxml},
    settings::{get_settings, save_settings},
};
use crate::auth::token::CachedToken;

pub struct Database {
    pub selected_connection_id: Mutex<Option<Uuid>>,
    pub token_cache: Mutex<HashMap<Uuid, CachedToken>>,
}

#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchContext {
    pub sql_file_path: Option<String>,
    pub connection_name: Option<String>,
}

impl Default for Database {
    fn default() -> Self {
        Self {
            selected_connection_id: Mutex::new(None),
            token_cache: Mutex::new(HashMap::new()),
        }
    }
}

fn parse_cli_args() -> LaunchContext {
    let mut sql_file_path = None;
    let mut connection_name = None;

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
    }

    LaunchContext {
        sql_file_path,
        connection_name,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(parse_cli_args())
        .manage(Database::default())
        .invoke_handler(tauri::generate_handler![
            create_connection,
            list_connections,
            set_connection,
            update_connection,
            execute_sql,
            list_entity_definitions,
            parse_sql_to_fetchxml,
            get_launch_context,
            open_sql_file,
            open_sql_file_path,
            save_sql_file,
            save_sql_file_as,
            get_settings,
            save_settings
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
