use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSqlRequest {
    pub sql: String,
    pub connection_id: Uuid,
}
