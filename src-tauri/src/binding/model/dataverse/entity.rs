use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum Value {
    Int(i64),
    Float(f64),
    String(String),
    Boolean(bool),
    Null,
}

pub type Attribute = String;

#[derive(Debug, Serialize, Deserialize)]
pub struct Entity {
    pub attributes: HashMap<Attribute, Value>,
}

impl Entity {
    pub fn new() -> Self {
        Entity {
            attributes: HashMap::new(),
        }
    }
}

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
