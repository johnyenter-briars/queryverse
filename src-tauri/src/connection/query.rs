use serde::Serialize;

use crate::{
    binding::model::{
        connection::Connection,
        entity::Entity,
        executesqlrequest::ExecuteSqlRequest,
        response::MultipleResponse,
    },
    connection::connection::{fetch_client_credentials_token, load_connections},
    dataverse::queryengine::QueryEngine,
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
    request: ExecuteSqlRequest,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let parsed = sql::sql_to_fetchxml(&request.sql).map_err(|e| e.to_string())?;

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| match connection {
            Connection::ClientCredentials { id, .. }
            | Connection::AuthorizationCode { id, .. } => id.as_ref() == Some(&request.connection_id),
        })
        .ok_or("Connection not found")?;

    let (token, d365_url) = match connection {
        Connection::ClientCredentials {
            client_id,
            client_secret,
            tenant_id,
            scope,
            d365_url,
            ..
        } => {
            let token =
                fetch_client_credentials_token(&client_id, &client_secret, &tenant_id, &scope)
                    .await?;
            (token, d365_url)
        }
        Connection::AuthorizationCode {
            access_token,
            d365_url,
            ..
        } => (access_token, d365_url),
    };

    if d365_url.trim().is_empty() {
        return Err("Connection is missing a D365 URL".to_string());
    }

    let query_engine = QueryEngine::new(&d365_url, &token);

    let resp = query_engine
        .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
        .await?;

    Ok(resp)
}
