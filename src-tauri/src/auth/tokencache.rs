use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const CONNECTION_PATH: &str = "../config/connection.json";
const TOKEN_CACHE_PATH: &str = "../config/token_cache.json";

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionConfig {
    client_id: String,
    client_secret: String,
    scope: String,
    tenant_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenCacheEntry {
    token_type: String,
    access_token: String,
}

pub struct TokenCache;

impl TokenCache {
    pub async fn get_token() -> Result<String, String> {
        let config = Self::ensure_connection_config()?;

        if let Some(token) = Self::load_cached_token()? {
            if !Self::is_expired(&token.access_token) {
                return Ok(token.access_token);
            }
        }

        let new_token = Self::fetch_new_token(&config).await?;

        Self::save_cached_token(&new_token)?;

        Ok(new_token.access_token)
    }

    fn ensure_connection_config() -> Result<ConnectionConfig, String> {
        if !Path::new(CONNECTION_PATH).exists() {
            let template = ConnectionConfig {
                client_id: "your-client-id".to_string(),
                client_secret: "your-client-secret".to_string(),
                scope: "https://yourorg.crm.dynamics.com/.default".to_string(),
                tenant_id: "your-tenant-id".to_string(),
            };

            if let Some(parent) = Path::new(CONNECTION_PATH).parent() {
                fs::create_dir_all(parent).ok();
            }

            let json = serde_json::to_string_pretty(&template).map_err(|e| e.to_string())?;

            fs::write(CONNECTION_PATH, json).map_err(|e| e.to_string())?;
        }

        let contents = fs::read_to_string(CONNECTION_PATH).map_err(|e| e.to_string())?;

        serde_json::from_str(&contents).map_err(|e| e.to_string())
    }

    fn load_cached_token() -> Result<Option<TokenCacheEntry>, String> {
        if !Path::new(TOKEN_CACHE_PATH).exists() {
            return Ok(None);
        }

        let contents = fs::read_to_string(TOKEN_CACHE_PATH).map_err(|e| e.to_string())?;

        if contents.trim().is_empty() {
            return Ok(None);
        }

        let token =
            serde_json::from_str::<TokenCacheEntry>(&contents).map_err(|e| e.to_string())?;

        Ok(Some(token))
    }

    fn save_cached_token(token: &TokenCacheEntry) -> Result<(), String> {
        if let Some(parent) = Path::new(TOKEN_CACHE_PATH).parent() {
            fs::create_dir_all(parent).ok();
        }

        let json = serde_json::to_string_pretty(token).map_err(|e| e.to_string())?;

        fs::write(TOKEN_CACHE_PATH, json).map_err(|e| e.to_string())?;

        Ok(())
    }

    fn is_expired(token: &str) -> bool {
        let decoding_key = DecodingKey::from_secret("".as_ref());

        let token_data = decode::<Value>(token, &decoding_key, &Validation::new(Algorithm::HS256));

        match token_data {
            Ok(data) => {
                let exp = data.claims.get("exp").and_then(|v| v.as_u64());
                if let Some(exp) = exp {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    now >= exp
                } else {
                    true
                }
            }
            Err(_) => true,
        }
    }

    async fn fetch_new_token(config: &ConnectionConfig) -> Result<TokenCacheEntry, String> {
        let client = reqwest::Client::new();

        let token_url = format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
            config.tenant_id
        );

        let mut params = std::collections::HashMap::new();

        params.insert("client_id", config.client_id.as_str());
        params.insert("client_secret", config.client_secret.as_str());
        params.insert("scope", config.scope.as_str());
        params.insert("grant_type", "client_credentials");

        let resp = client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(body);
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        let access_token = json
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("No access_token in response")?;

        let token_type = json
            .get("token_type")
            .and_then(|v| v.as_str())
            .unwrap_or("Bearer");

        Ok(TokenCacheEntry {
            access_token: access_token.to_string(),
            token_type: token_type.to_string(),
        })
    }
}
