pub mod binding;
pub mod connection;
pub mod oauth;
pub mod dataverse;
pub mod sql;

use crate::connection::connection::create_connection;
use crate::connection::query::{execute_sql, parse_sql_to_fetchxml};

use tauri::Manager;

pub struct Database;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Database {})
        .invoke_handler(tauri::generate_handler![
            create_connection,
            execute_sql,
            parse_sql_to_fetchxml
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
