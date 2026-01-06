use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct QVResponse<T> {
    pub message: String,
    pub success: bool,
    pub value: T,
}
