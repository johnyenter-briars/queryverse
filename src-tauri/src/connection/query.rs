use crate::{Database, binding::model::multipleresponse::MultipleResponse, dataverse::queryengine::QueryEngine, oauth::tokencache::TokenCache};

#[tauri::command]
pub async fn query_results(
    _window: tauri::Window,
    _number: usize,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse, String> {
    let token = TokenCache::get_token().await?;

    let query_engine = QueryEngine::new("https://jyb.crm.dynamics.com/", &token);

    let accounts = query_engine.query_accounts(Some("accountnumber eq 'ABSS4G45'")).await?;

    println!("Accounts: {}", accounts);

    let resp = MultipleResponse::new();

    return Ok(resp);
}
