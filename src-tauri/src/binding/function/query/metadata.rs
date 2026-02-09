use crate::{
    auth::{connection::load_connections, token::get_access_token},
    binding::model::{
        response::MultipleResponse,
    },
    Database,
};
use powerplatform_dataverse_client::dataverse::{entityattribute::EntityAttribute, entitydefinition::EntityDefinition, servicecilent::ServiceClient};

#[tauri::command]
pub async fn list_entity_definitions(
    _window: tauri::Window,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
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
        .find(|connection| connection.id().as_ref() == Some(&connection_id))
        .ok_or("Connection not found")?;

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();

    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);
    let value = service_client.list_entity_definitions().await?;

    Ok(MultipleResponse {
        message: "Metadata retrieved.".to_string(),
        success: true,
        value,
    })
}

#[tauri::command]
pub async fn list_entity_attributes(
    _window: tauri::Window,
    logical_name: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<MultipleResponse<EntityAttribute>, String> {
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
        .find(|connection| connection.id().as_ref() == Some(&connection_id))
        .ok_or("Connection not found")?;

    let token = get_access_token(&connection, &database).await?;

    let dataverse_url = connection.dataverse_url();

    if dataverse_url.trim().is_empty() {
        return Err("Connection is missing a Dataverse URL".to_string());
    }

    let service_client = ServiceClient::new(&dataverse_url, &token, context.log_level);
    let value = service_client
        .list_entity_attributes(&logical_name)
        .await?;

    Ok(MultipleResponse {
        message: "Attributes retrieved.".to_string(),
        success: true,
        value,
    })
}
