use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::binding::model::createconnectionpayload::CreateConnectionPayload;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConnectionRequest {
    pub id: Option<Uuid>,
    pub index: usize,
    pub payload: CreateConnectionPayload,
}
