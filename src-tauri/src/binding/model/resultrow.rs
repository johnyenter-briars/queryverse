use std::collections::HashMap;

use powerplatform_dataverse_client::dataverse::entity::{Attribute, Value};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultRow {
    pub attributes: HashMap<Attribute, Value>,
}

impl Default for ResultRow {
    fn default() -> Self {
        Self::new()
    }
}

impl ResultRow {
    pub fn new() -> Self {
        ResultRow {
            attributes: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ResultRow;

    #[test]
    fn new_creates_empty_attribute_map() {
        assert!(ResultRow::new().attributes.is_empty());
        assert!(ResultRow::default().attributes.is_empty());
    }
}
