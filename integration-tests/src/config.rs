use std::fs;
use std::path::PathBuf;

use serde::Deserialize;
use powerplatform_dataverse_client::auth::config::AuthConfig;

#[derive(Debug, Deserialize)]
pub struct Secrets {
    #[serde(default)]
    pub connection_string: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub client_secret: Option<String>,
    #[serde(default)]
    pub dataverse_url: Option<String>,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub token_cache_store_path: Option<String>,
}

impl Secrets {
    pub fn auth_config(&self) -> Result<AuthConfig, String> {
        let client_id = self
            .client_id
            .clone()
            .ok_or("Missing client_id in secrets.json")?;
        let client_secret = self
            .client_secret
            .clone()
            .ok_or("Missing client_secret in secrets.json")?;
        let tenant_id = self
            .tenant_id
            .clone()
            .ok_or("Missing tenant_id in secrets.json")?;
        let dataverse_url = self
            .dataverse_url
            .clone()
            .ok_or("Missing dataverse_url in secrets.json")?;

        Ok(AuthConfig::ClientCredentials {
            client_id,
            client_secret,
            tenant_id,
            dataverse_url,
            token_cache_store_path: self.token_cache_store_path.clone(),
        })
    }
}

pub fn load_secrets() -> Result<Secrets, String> {
    let mut path = std::env::current_dir().map_err(|e| e.to_string())?;
    path.push("secrets.json");
    read_secrets(&path)
}

fn read_secrets(path: &PathBuf) -> Result<Secrets, String> {
    let contents = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read secrets.json: {e}"))?;
    serde_json::from_str(&contents).map_err(|e| format!("Invalid secrets.json: {e}"))
}
