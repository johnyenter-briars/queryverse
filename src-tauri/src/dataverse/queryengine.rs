use reqwest::Client;
use serde_json::Value;

pub struct QueryEngine {
    client: Client,
    base_url: String,
    token: String,
}

impl QueryEngine {
    pub fn new(base_url: &str, token: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    pub async fn query_accounts(&self, filter: Option<&str>) -> Result<Value, String> {
        let mut url = format!("{}/api/data/v9.2/accounts", self.base_url);

        if let Some(f) = filter {
            url.push_str(&format!("?$filter={}", urlencoding::encode(f)));
        }

        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.token)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        let status = resp.status();

        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Dataverse API error ({}): {}", status, body));
        }

        let json: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))?;

        Ok(json)
    }
}

