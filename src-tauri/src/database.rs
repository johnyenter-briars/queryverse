use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::async_runtime::Mutex as AsyncMutex;
use uuid::Uuid;

use powerplatform_dataverse_client::dataverse::{
    entityattribute::EntityAttribute, entitydefinition::EntityDefinition,
    entityrelationship::EntityRelationship,
    serviceclient::ServiceClient,
};

pub struct Database {
    // Tracks the active Dataverse connection selected in the UI.
    pub selected_connection_id: Mutex<Option<Uuid>>,
    // Keeps long-lived service clients available across async command handlers.
    pub service_clients: AsyncMutex<HashMap<Uuid, Arc<ServiceClient>>>,
    // Caches entity metadata per connection to avoid refetching schema details.
    pub entity_definitions_cache: Mutex<HashMap<Uuid, Vec<EntityDefinition>>>,
    // Caches attribute metadata by connection and entity logical name.
    pub entity_attributes_cache: Mutex<HashMap<(Uuid, String), Vec<EntityAttribute>>>,
    // Caches relationship metadata by connection and entity logical name.
    pub entity_relationships_cache: Mutex<HashMap<(Uuid, String), Vec<EntityRelationship>>>,
    // Holds prepared update batches until the user executes or discards them.
    pub update_batches: Mutex<HashMap<String, UpdateSet>>,
    // Holds prepared delete batches until the user executes or discards them.
    pub delete_batches: Mutex<HashMap<String, DeleteSet>>,
}

#[derive(Debug, Clone)]
pub struct UpdateSet {
    // Identifies which authenticated client should execute this batch.
    pub connection_id: Uuid,
    // Dataverse entity set name used by the HTTP API.
    pub entity_set: String,
    // Logical entity name used when resolving metadata and attributes.
    pub entity_logical: String,
    // Primary key column required to address each target record.
    pub primary_id_attribute: String,
    // Record ids targeted by the pending update operation.
    pub ids: Vec<String>,
    // Field/value pairs applied to every id in this prepared set.
    pub updates: HashMap<String, JsonValue>,
}

#[derive(Debug, Clone)]
pub struct DeleteSet {
    // Identifies which authenticated client should execute this batch.
    pub connection_id: Uuid,
    // Dataverse entity set name used by the HTTP API.
    pub entity_set: String,
    // Logical entity name used when resolving metadata and attributes.
    pub entity_logical: String,
    // Primary key column required to address each target record.
    pub primary_id_attribute: String,
    // Record ids queued for deletion when the batch is executed.
    pub ids: Vec<String>,
}

impl Default for Database {
    fn default() -> Self {
        Self {
            // Startup begins with no active connection until the user selects one.
            selected_connection_id: Mutex::new(None),
            // Clients and caches are populated lazily as commands access connections and metadata.
            service_clients: AsyncMutex::new(HashMap::new()),
            entity_definitions_cache: Mutex::new(HashMap::new()),
            entity_attributes_cache: Mutex::new(HashMap::new()),
            entity_relationships_cache: Mutex::new(HashMap::new()),
            // Prepared mutation batches exist only for the lifetime of the current app session.
            update_batches: Mutex::new(HashMap::new()),
            delete_batches: Mutex::new(HashMap::new()),
        }
    }
}
