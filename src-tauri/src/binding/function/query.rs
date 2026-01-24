use serde::Serialize;

use crate::{
    Database,
    auth::{connection::load_connections, credentials::fetch_client_credentials_token},
    binding::model::{
        connection::Connection,
        dataverse::entity::Entity,
        dataverse::entitydefinition::EntityDefinition,
        executesqlrequest::ExecuteSqlRequest,
        response::MultipleResponse,
    },
    dataverse::queryengine::QueryEngine,
    sql,
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
    database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let parsed = sql::sql_to_fetchxml(&request.sql).map_err(|e| e.to_string())?;

    let connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| match connection {
            Connection::ClientCredentials { id, .. }
            | Connection::AuthorizationCode { id, .. } => id.as_ref() == Some(&connection_id),
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

    let metadata = query_engine
        .get_entity_metadata(&parsed.entity_logical)
        .await?;

    if let Some(primary_id_attribute) = metadata.primary_id_attribute {
        println!("PrimaryIdAttribute: {}", primary_id_attribute);
    }

    let resp = query_engine
        .retrieve_multiple_fetchxml(&parsed.entity_set, &parsed.fetchxml)
        .await?;

    Ok(resp)
}

#[tauri::command]
pub async fn list_entity_definitions(
    _window: tauri::Window,
    database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<EntityDefinition>, String> {
    let connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| match connection {
            Connection::ClientCredentials { id, .. }
            | Connection::AuthorizationCode { id, .. } => id.as_ref() == Some(&connection_id),
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
    let value = query_engine.list_entity_definitions().await?;

    Ok(MultipleResponse {
        message: "Metadata retrieved.".to_string(),
        success: true,
        value,
    })
}
