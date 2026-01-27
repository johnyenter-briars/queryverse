use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub vim_enabled: bool,
    pub key_bindings_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            vim_enabled: true,
            key_bindings_enabled: true,
        }
    }
}

