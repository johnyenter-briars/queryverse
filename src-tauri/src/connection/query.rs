use crate::{
    binding::model::{entity::Entity, response::MultipleResponse},
    dataverse::queryengine::QueryEngine,
    oauth::tokencache::TokenCache,
    Database,
};

#[tauri::command]
pub async fn retrieve_multiple(
    _window: tauri::Window,
    _number: usize,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let token = TokenCache::get_token().await?;

    let query_engine = QueryEngine::new("https://jyb.crm.dynamics.com/", &token);

    let resp = query_engine
        .retrieve_multiple_accounts(Some("accountid ne null"), Some("accountid,name,statecode,statuscode,cref1_syncedwithstar,donotsendmm,numberofemployees"))
        .await?;

    return Ok(resp);
}
