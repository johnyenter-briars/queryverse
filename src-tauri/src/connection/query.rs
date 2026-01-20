use serde::Serialize;

use crate::{
    binding::model::{entity::Entity, response::MultipleResponse},
    dataverse::queryengine::QueryEngine,
    oauth::tokencache::TokenCache,
    sql_fetchxml,
    Database,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchXmlPreview {
    pub entity: String,
    pub fetch_xml: String,
}

#[tauri::command]
pub async fn parse_sql_to_fetchxml(
    _window: tauri::Window,
    sql: String,
) -> Result<FetchXmlPreview, String> {
    let parsed = sql_fetchxml::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;

    Ok(FetchXmlPreview {
        entity: parsed.entity,
        fetch_xml: parsed.fetchxml,
    })
}

#[tauri::command]
pub async fn execute_sql(
    _window: tauri::Window,
    sql: String,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let parsed = sql_fetchxml::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;

    let token = TokenCache::get_token().await?;
    let query_engine = QueryEngine::new("https://jyb.crm.dynamics.com/", &token);

    let resp = query_engine
        .retrieve_multiple_fetchxml(&parsed.entity, &parsed.fetchxml)
        .await?;

    Ok(resp)
}
