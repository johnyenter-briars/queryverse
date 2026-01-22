use crate::{
    binding::model::{entity::Entity, response::MultipleResponse, retrievemultiplerequest::RetrieveMultipleRequest},
    connection::connection::{fetch_client_credentials_token, load_connections},
    dataverse::queryengine::QueryEngine,
    Database,
};

#[tauri::command]
pub async fn retrieve_multiple(
    _window: tauri::Window,
    request: RetrieveMultipleRequest,
    _database: tauri::State<'_, Database>,
) -> Result<MultipleResponse<Entity>, String> {
    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| match connection {
            crate::binding::model::connection::Connection::ClientCredentials { id, .. }
            | crate::binding::model::connection::Connection::AuthorizationCode { id, .. } => {
                id.as_ref() == Some(&request.connection_id)
            }
        })
        .ok_or("Connection not found")?;

    let (token, d365_url) = match connection {
        crate::binding::model::connection::Connection::ClientCredentials {
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
        //TODO - this is wrong
        crate::binding::model::connection::Connection::AuthorizationCode {
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
        .retrieve_multiple_accounts(Some("accountid ne null"), Some("accountid,name,statecode,statuscode,cref1_syncedwithstar,donotsendmm,numberofemployees"))
        .await?;

    return Ok(resp);
}
