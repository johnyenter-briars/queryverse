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

use crate::jobs::{JobResultStore, JobStore, create_job_result_store, create_job_store};

/// Central in-memory state bag shared across Tauri command handlers.
///
/// QueryVerse keeps this state process-local on purpose: authenticated clients, metadata caches,
/// prepared mutation batches, and background job bookkeeping all need to outlive a single command
/// invocation but do not need to be persisted to disk.
///
/// This struct is effectively QueryVerse's backend "working set". If a command needs to share
/// state with another command later in the session, it usually ends up represented here.
pub struct Database {
    /// Tracks the active Dataverse connection selected in the UI.
    ///
    /// This is a simple synchronous mutex because callers only read or replace the option itself;
    /// no async work needs to happen while the guard is held.
    pub selected_connection_id: Mutex<Option<Uuid>>,
    /// Keeps long-lived service clients available across async command handlers.
    ///
    /// Each client is expensive to construct because it performs auth bootstrap and metadata
    /// setup, so we hold them behind an async mutex and reuse them for subsequent requests.
    pub service_clients: AsyncMutex<HashMap<Uuid, Arc<ServiceClient>>>,
    /// Caches entity metadata per connection to avoid refetching schema details.
    ///
    /// This is the broad schema list used by intellisense, schema explorer, and query planning.
    pub entity_definitions_cache: Mutex<HashMap<Uuid, Vec<EntityDefinition>>>,
    /// Caches attribute metadata by connection and entity logical name.
    ///
    /// The tuple key lets us cache many entities for the same connection without nesting maps.
    pub entity_attributes_cache: Mutex<HashMap<(Uuid, String), Vec<EntityAttribute>>>,
    /// Caches relationship metadata by connection and entity logical name.
    ///
    /// Relationship lookup powers join suggestions and schema browsing, so it shares the same key
    /// shape as the attribute cache for straightforward invalidation.
    pub entity_relationships_cache: Mutex<HashMap<(Uuid, String), Vec<EntityRelationship>>>,
    /// Holds prepared update batches until the user executes or discards them.
    ///
    /// The string key is an opaque token returned to the frontend after preview/prepare succeeds.
    /// That token decouples "find candidate rows" from "actually mutate them", which lets the UI
    /// show a review step before any update request is sent to Dataverse.
    pub update_batches: Mutex<HashMap<String, UpdateSet>>,
    /// Holds prepared delete batches until the user executes or discards them.
    ///
    /// Delete preview uses the same token-based pattern as update preview so execution remains a
    /// deliberate follow-up action instead of happening directly from raw SQL text.
    pub delete_batches: Mutex<HashMap<String, DeleteSet>>,
    /// Tracks long-running background jobs and their progress.
    ///
    /// This store contains the live progress/status record that polling UI surfaces.
    pub background_jobs: JobStore,
    /// Holds completed background job result sets keyed by job id.
    ///
    /// Result payloads live separately from the status map because they can be much larger than
    /// the status metadata and are often fetched only once after a job completes.
    pub background_job_results: JobResultStore,
}

/// Prepared update execution payload captured during the preview phase.
///
/// QueryVerse resolves metadata, primary ids, and serialized field values up front so the later
/// execute command can run without reparsing SQL or re-deriving target metadata.
///
/// This is intentionally shaped around Dataverse execution needs rather than mirroring the raw SQL
/// AST. By the time an `UpdateSet` exists, SQL parsing and semantic validation have already
/// happened elsewhere.
#[derive(Debug, Clone)]
pub struct UpdateSet {
    /// Identifies which authenticated client should execute this batch.
    pub connection_id: Uuid,
    /// Dataverse entity set name used by the HTTP API.
    pub entity_set: String,
    /// Logical entity name used when resolving metadata and attributes.
    pub entity_logical: String,
    /// Primary key column required to address each target record.
    pub primary_id_attribute: String,
    /// Record ids targeted by the pending update operation.
    pub ids: Vec<String>,
    /// Field/value pairs applied to every id in this prepared set.
    ///
    /// Values are stored as generic JSON because command preparation has already normalized them
    /// into the shape the Dataverse batch writer expects.
    pub updates: HashMap<String, JsonValue>,
}

/// Prepared delete execution payload captured during the preview phase.
///
/// Delete batches need less payload than update batches because each operation is just an id
/// deletion against a resolved entity set, but they still carry the same connection/entity context.
/// Keeping both staged mutation structs parallel makes the preview/execute pipeline easier to
/// reason about across update and delete code paths.
#[derive(Debug, Clone)]
pub struct DeleteSet {
    /// Identifies which authenticated client should execute this batch.
    pub connection_id: Uuid,
    /// Dataverse entity set name used by the HTTP API.
    pub entity_set: String,
    /// Logical entity name used when resolving metadata and attributes.
    pub entity_logical: String,
    /// Primary key column required to address each target record.
    pub primary_id_attribute: String,
    /// Record ids queued for deletion when the batch is executed.
    pub ids: Vec<String>,
}

impl Default for Database {
    fn default() -> Self {
        Self {
            // Startup begins with no active connection until the user selects one.
            selected_connection_id: Mutex::new(None),
            // Clients and caches are populated lazily as commands access connections and metadata.
            // Cold start avoids doing any auth or metadata IO before the user actually needs it.
            service_clients: AsyncMutex::new(HashMap::new()),
            entity_definitions_cache: Mutex::new(HashMap::new()),
            entity_attributes_cache: Mutex::new(HashMap::new()),
            entity_relationships_cache: Mutex::new(HashMap::new()),
            // Prepared mutation batches exist only for the lifetime of the current app session.
            // A restart intentionally drops any unexecuted preview token so stale mutation plans do
            // not survive beyond the process that created them.
            update_batches: Mutex::new(HashMap::new()),
            delete_batches: Mutex::new(HashMap::new()),
            background_jobs: create_job_store(),
            background_job_results: create_job_result_store(),
        }
    }
}
