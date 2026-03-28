pub mod auth;
pub mod binding;
mod database;
mod export;
mod jobs;
mod logging;
pub mod sql;

extern crate tauri;
extern crate tauri_plugin_opener;

use tauri::Manager;

use crate::binding::function::{
    connection::{
        create_connection, create_connection_folder, delete_connection, delete_connection_folder,
        get_default_connection, list_connection_tree, list_connections, move_connection,
        move_connection_folder, set_connection, update_connection, update_connection_folder,
        update_connection_folder_color,
    },
    export::{export_csv, export_excel},
    file::{open_sql_file, open_sql_file_path, save_sql_file, save_sql_file_as},
    job::{cancel_background_job, get_background_job_result, get_background_job_status},
    launch::get_launch_context,
    logging::log_frontend,
    query::{
        discard_delete_sql, discard_update_sql, execute_delete_sql, execute_sql,
        execute_update_sql, list_entity_attributes, list_entity_definitions,
        list_entity_relationships, parse_sql_to_fetchxml, prepare_delete_sql, prepare_update_sql,
    },
    settings::{get_settings, save_settings},
};
pub use crate::database::{Database, DeleteSet, UpdateSet};
pub use powerplatform_dataverse_client::LogLevel;

#[derive(Default, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchContext {
    // Optional SQL file to load immediately after the app starts.
    pub sql_file_path: Option<String>,
    // Optional saved connection name to select on launch.
    pub connection_name: Option<String>,
    // Controls backend logging before the frontend is initialized.
    pub log_level: LogLevel,
    // Opens the Tauri devtools on startup for debugging local runs.
    pub open_webview_console: bool,
}

fn parse_cli_args() -> LaunchContext {
    let mut sql_file_path = None;
    let mut connection_name = None;
    let mut log_level = LogLevel::Error;
    let mut open_webview_console = false;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        // Support both "--flag value" and "--flag=value" forms for launch integration.
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
            if let Some(value) = args.next()
                && let Some(parsed) = parse_log_level(&value)
            {
                log_level = parsed;
            }
            continue;
        }
        if let Some(value) = arg.strip_prefix("--log-level=") {
            if let Some(parsed) = parse_log_level(value) {
                log_level = parsed;
            }
            continue;
        }
        if arg == "--open-webview-console" || arg == "--open-webview-devtools" {
            open_webview_console = true;
            continue;
        }
    }

    LaunchContext {
        sql_file_path,
        connection_name,
        log_level,
        open_webview_console,
    }
}

fn parse_log_level(value: &str) -> Option<LogLevel> {
    // Accept a few human-friendly aliases from shortcuts or manual CLI invocation.
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
        // Share startup context and backend state with all Tauri commands.
        .manage(launch_context.clone())
        .manage(Database::default())
        .invoke_handler(tauri::generate_handler![
            create_connection,
            get_default_connection,
            list_connections,
            list_connection_tree,
            create_connection_folder,
            update_connection_folder_color,
            update_connection_folder,
            delete_connection,
            delete_connection_folder,
            move_connection,
            move_connection_folder,
            export_csv,
            export_excel,
            set_connection,
            update_connection,
            execute_sql,
            list_entity_attributes,
            list_entity_definitions,
            list_entity_relationships,
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
            get_background_job_status,
            get_background_job_result,
            cancel_background_job,
            log_frontend
        ])
        .setup(move |app| {
            let windows = app.webview_windows();
            let window = windows.get("QueryVerse").unwrap();
            if launch_context.open_webview_console {
                // Tauri only exposes opening devtools directly, so close it immediately to avoid focus theft.
                window.open_devtools();
                window.close_devtools(); // Dev tools starts open but not steal focus
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
