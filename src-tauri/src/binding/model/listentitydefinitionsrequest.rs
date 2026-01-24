use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntityDefinitionsRequest {
    pub connection_id: Uuid,
}
