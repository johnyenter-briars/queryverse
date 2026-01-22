use serde::Serialize;

use crate::{
    binding::model::{entity::Entity, response::MultipleResponse},
    dataverse::queryengine::QueryEngine,
    oauth::tokencache::TokenCache,
    sql,
    Database,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchXmlPreview {
    pub entity_set: String,
    pub entity_logical: String,
    pub fetch_xml: String,
}

#[tauri::command]
pub async fn parse_sql_to_fetchxml(
    _window: tauri::Window,
    sql: String,
) -> Result<FetchXmlPreview, String> {
    let parsed = sql::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;

    Ok(FetchXmlPreview {
        entity_set: parsed.entity_set,
        entity_logical: parsed.entity_logical,
        fetch_xml: parsed.fetchxml,
    })
}

#[tauri::command]
pub async fn execute_sql(
    _window: tauri::Window,
    sql: String,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let parsed = sql::sql_to_fetchxml(&sql).map_err(|e| e.to_string())?;

    let token = TokenCache::get_token().await?;
    let query_engine = QueryEngine::new("https://jyb.crm.dynamics.com/", &token);

    let resp = query_engine
        .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
        .await?;

    Ok(resp)
}
