use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Int(i64),
    String(String),//TODO: should be this be a string or an &Str?
    Boolean(bool),
    Null,
}

pub type Attribute = String;

#[derive(Debug, Serialize, Deserialize)]
pub struct Entity {
    #[serde(flatten)]
    pub attributes: HashMap<Attribute, Value>,
}

impl Entity {
    pub fn new() -> Self {
        Entity {
            attributes: HashMap::new(),
        }
    }
}
