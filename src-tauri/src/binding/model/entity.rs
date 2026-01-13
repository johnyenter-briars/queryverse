use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Int(i64),
    String(String),
    Bool(bool),
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
