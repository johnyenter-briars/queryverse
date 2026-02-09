use std::collections::HashMap;

use powerplatform_dataverse_client::dataverse::entity::{Attribute, Value};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ResultRow {
    pub attributes: HashMap<Attribute, Value>,
}

impl ResultRow {
    pub fn new() -> Self {
        ResultRow {
            attributes: HashMap::new(),
        }
    }
}
