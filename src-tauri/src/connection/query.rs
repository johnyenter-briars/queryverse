use crate::{Database, binding::model::multipleresponse::MultipleResponse, dataverse::queryengine::QueryEngine, oauth::tokencache::TokenCache};

#[tauri::command]
pub async fn query_results(
    window: tauri::Window,
    _number: usize,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse, String> {
    let response_result = reqwest::get("https://www.rust-lang.org").await;

    let token = TokenCache::get_token().await?;

    let query_engine = QueryEngine::new("https://jyb.crm.dynamics.com/", &token);

    let accounts = query_engine.query_accounts(Some("accountnumber eq 'ABSS4G45'")).await?;

    println!("Accounts: {}", accounts);

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

    let resp = MultipleResponse::new();

    return Ok(resp);
}
