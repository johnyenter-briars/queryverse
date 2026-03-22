use serde::{Deserialize, Serialize};

use crate::binding::model::{connection::Connection, connectionfolder::ConnectionFolder};

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ConnectionTreeItem {
    Folder(ConnectionFolderTreeItem),
    Connection(Connection),
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionFolderTreeItem {
    #[serde(flatten)]
    pub folder: ConnectionFolder,
    pub children: Vec<ConnectionTreeItem>,
}
