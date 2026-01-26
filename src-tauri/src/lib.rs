pub mod binding;
pub mod dataverse;
pub mod auth;
pub mod sql;

use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;

use crate::binding::function::{
    connection::{create_connection, list_connections, set_connection, update_connection},
    file::{open_sql_file, save_sql_file, save_sql_file_as},
    query::{execute_sql, list_entity_definitions, parse_sql_to_fetchxml},
};

pub struct Database {
    pub selected_connection_id: Mutex<Option<Uuid>>,
}

impl Default for Database {
    fn default() -> Self {
        Self {
            selected_connection_id: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Database::default())
        .invoke_handler(tauri::generate_handler![
            create_connection,
            list_connections,
            set_connection,
            update_connection,
            execute_sql,
            list_entity_definitions,
            parse_sql_to_fetchxml,
            open_sql_file,
            save_sql_file,
            save_sql_file_as
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
