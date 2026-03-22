use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use crate::binding::model::{
    connection::Connection,
    connectionfolder::ConnectionFolder,
    connectiontreeitem::{ConnectionFolderTreeItem, ConnectionTreeItem},
};
use powerplatform_dataverse_client::auth::config::AuthConfig;

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ConnectionsDocument {
    #[serde(default)]
    folders: Vec<ConnectionFolder>,
    #[serde(default)]
    connections: Vec<Connection>,
}

pub fn load_connections() -> Result<Vec<Connection>, String> {
    Ok(load_connections_document()?.connections)
}

pub fn load_connection_folders() -> Result<Vec<ConnectionFolder>, String> {
    Ok(load_connections_document()?.folders)
}

pub fn load_connection_tree() -> Result<Vec<ConnectionTreeItem>, String> {
    let document = load_connections_document()?;
    build_connection_tree(&document.folders, &document.connections, None)
}

pub fn save_connection(connection: &Connection) -> Result<(), String> {
    let mut document = load_connections_document()?;
    document.connections.push(connection.clone());
    save_connections_document(&document)
}

pub fn save_connection_folder(folder: &ConnectionFolder) -> Result<(), String> {
    let mut document = load_connections_document()?;
    document.folders.push(folder.clone());
    save_connections_document(&document)
}

pub fn save_connections(connections: &[Connection]) -> Result<(), String> {
    let mut document = load_connections_document()?;
    document.connections = connections.to_vec();
    save_connections_document(&document)
}

pub fn save_connection_folders(folders: &[ConnectionFolder]) -> Result<(), String> {
    let mut document = load_connections_document()?;
    document.folders = folders.to_vec();
    save_connections_document(&document)
}

pub fn folder_exists(folder_id: Uuid) -> Result<bool, String> {
    Ok(load_connections_document()?
        .folders
        .iter()
        .any(|folder| folder.id == folder_id))
}

pub fn new_connection_folder(name: String, parent_folder_id: Option<Uuid>) -> ConnectionFolder {
    ConnectionFolder {
        id: Uuid::new_v4(),
        name,
        parent_folder_id,
        color: None,
        generated_on: utc_timestamp(),
    }
}

fn load_connections_document() -> Result<ConnectionsDocument, String> {
    let path = connections_path()?;

    if !path.exists() {
        return Ok(ConnectionsDocument::default());
    }

    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    if contents.trim().is_empty() {
        return Ok(ConnectionsDocument::default());
    }

    if let Ok(document) = serde_json::from_str::<ConnectionsDocument>(&contents) {
        return Ok(document);
    }

    let connections = serde_json::from_str::<Vec<Connection>>(&contents).map_err(|e| e.to_string())?;
    Ok(ConnectionsDocument {
        folders: vec![],
        connections,
    })
}

pub fn connections_path() -> Result<PathBuf, String> {
    let dir = queryverse_data_dir()?;
    Ok(dir.join("connections.json"))
}

pub fn queryverse_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or("Unable to resolve local app data directory")?;
    let dir = base.join("QueryVerse");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn save_connections_document(document: &ConnectionsDocument) -> Result<(), String> {
    let path = connections_path()?;
    let json = serde_json::to_string_pretty(document).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn build_connection_tree(
    folders: &[ConnectionFolder],
    connections: &[Connection],
    parent_folder_id: Option<Uuid>,
) -> Result<Vec<ConnectionTreeItem>, String> {
    let mut items = Vec::new();

    let mut child_folders: Vec<ConnectionFolder> = folders
        .iter()
        .filter(|folder| folder.parent_folder_id == parent_folder_id)
        .cloned()
        .collect();
    child_folders.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    for folder in child_folders {
        let children = build_connection_tree(folders, connections, Some(folder.id))?;
        items.push(ConnectionTreeItem::Folder(ConnectionFolderTreeItem { folder, children }));
    }

    let mut child_connections: Vec<Connection> = connections
        .iter()
        .filter(|connection| connection.parent_folder_id == parent_folder_id)
        .cloned()
        .collect();
    child_connections.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    for connection in child_connections {
        items.push(ConnectionTreeItem::Connection(connection));
    }

    Ok(items)
}

pub fn default_token_cache_store_path(connection_id: Uuid) -> Result<String, String> {
    let dir = queryverse_data_dir()?
        .join("tokencache")
        .join(connection_id.to_string());
    Ok(dir.to_string_lossy().to_string())
}

pub fn get_default_connection() -> Result<Connection, String> {
    let connection_id = Uuid::new_v4();
    let token_cache_store_path = Some(default_token_cache_store_path(connection_id)?);

    Ok(Connection {
        id: Some(connection_id),
        name: String::new(),
        parent_folder_id: None,
        auth: AuthConfig::ClientCredentials {
            client_id: String::new(),
            client_secret: String::new(),
            tenant_id: String::new(),
            dataverse_url: String::new(),
            token_cache_store_path,
        },
        generated_on: utc_timestamp(),
    })
}

pub fn utc_timestamp() -> String {
    Utc::now().to_rfc3339()
}
