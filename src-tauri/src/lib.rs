pub mod binding;

use crate::binding::model::qvresponse::{QVResponse};

struct Database;

#[derive(serde::Serialize)]
struct CustomResponse {
    message: String,
    other_val: usize,
}

async fn some_other_function() -> Option<String> {
    Some("response".into())
}

#[tauri::command]
async fn query_results(
    window: tauri::Window,
    number: usize,
    database: tauri::State<'_, Database>,
) -> Result<QVResponse<Vec<String>>, String> {
    let response_result = reqwest::get("https://www.rust-lang.org").await;

    if let Ok(response) = response_result {
        if let Ok(body) = response.text().await {
            println!("body = {body:?}");
        } else {
            return Err("error".into());
        }
    } else {
        return Err("error".into());
    }

    println!("Called from {}", window.label());
    let result: Option<String> = some_other_function().await;

    if let Some(message) = result {
    } else {
    }

    let resp = QVResponse::<Vec<String>>::new();

    return Ok(resp);
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Database {})
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![query_results])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
