use reqwest::Client;
use serde_json::Value;

use crate::binding::model::entity::Entity;
use crate::binding::model::entity::Value::Int;
use crate::binding::model::response::MultipleResponse;

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

    pub async fn query_accounts(
        &self,
        filter: Option<&str>,
    ) -> Result<MultipleResponse<Entity>, String> {
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

        let response_object = json
            .as_object()
            .ok_or_else(|| "Invalid response from Dataverse".to_string())?;

        let response_array = response_object
            .get("value")
            .ok_or_else(|| "Invalid response from Dataverse".to_string())?
            .as_array()
            .ok_or_else(|| "Invalid response from Dataverse".to_string())?;

        let mut entities: Vec<Entity> = vec![];

        for record_value in response_array {
            let mut entity = Entity::new();

            let record = record_value
                .as_object()
                .ok_or_else(|| "Invalid response from Dataverse".to_string())?;

            for (key, value) in record {
                if !value.is_i64() {
                    continue;
                }

                let i = value
                    .as_i64()
                    .ok_or_else(|| "Invalid response from Dataverse".to_string())?;

                entity.attributes.insert(key.to_string(), Int(i));
            }

            entities.push(entity);
        }

        let mut multi_resposne = MultipleResponse::new();

        multi_resposne.value = entities;

        Ok(multi_resposne)
    }
}
