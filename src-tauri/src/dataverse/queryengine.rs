use reqwest::Client;
use serde_json::Value;

use crate::binding::model::dataverse::entity::Entity;
use crate::binding::model::dataverse::entity::Value::{Boolean, Int, Null, String};
use crate::binding::model::dataverse::entitydefinition::EntityDefinition;
use crate::binding::model::response::MultipleResponse;

#[derive(Debug, serde::Deserialize)]
struct ODataList<T> {
    value: Vec<T>,
}

#[derive(Debug)]
enum ValueTypeImplented {
    True,
    False,
}

pub struct QueryEngine {
    client: Client,
    base_url: std::string::String,
    token: std::string::String,
}

impl QueryEngine {
    pub fn new(base_url: &str, token: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    pub async fn retrieve_multiple_accounts(
        &self,
        filter: Option<&str>,
        select: Option<&str>,
    ) -> Result<MultipleResponse<Entity>, std::string::String> {
        let mut url = format!("{}/api/data/v9.2/accounts", self.base_url);

        if let Some(f) = filter {
            url.push_str(&format!("?$filter={}", urlencoding::encode(f)));
        }

        if let Some(s) = select {
            url.push_str(&format!("&$select={}", urlencoding::encode(s)));
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

        parse_multiple_response(json)
    }

    pub async fn get_entity_metadata(
        &self,
        entity_logical: &str,
    ) -> Result<EntityDefinition, std::string::String> {
        let logical = entity_logical.replace('\'', "''");
        let url = format!(
            "{}/api/data/v9.2/EntityDefinitions(LogicalName='{}')",
            self.base_url, logical
        );

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

        resp.json::<EntityDefinition>()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))
    }

    pub async fn retrieve_multiple_fetchxml(
        &self,
        entity: &str,
        fetchxml: &str,
    ) -> Result<MultipleResponse<Entity>, std::string::String> {
        let mut url = format!("{}/api/data/v9.2/{}", self.base_url, entity);
        url.push_str("?fetchXml=");
        url.push_str(&urlencoding::encode(fetchxml));

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

        parse_multiple_response(json)
    }

    pub async fn list_entity_definitions(
        &self,
    ) -> Result<Vec<EntityDefinition>, std::string::String> {
        let url = format!(
            "{}/api/data/v9.2/EntityDefinitions?$select=LogicalName,SchemaName,DisplayName,EntitySetName,IsCustomEntity",
            self.base_url
        );

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

        let parsed: ODataList<EntityDefinition> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))?;

        Ok(parsed.value)
    }
}

fn add_attribute(
    entity: &mut Entity,
    key: &str,
    value: &Value,
) -> Result<ValueTypeImplented, std::string::String> {
    if value.is_null() {
        entity.attributes.insert(key.to_string(), Null);

        return Ok(ValueTypeImplented::True);
    }

    if !value.is_i64() && !value.is_string() && !value.is_boolean() {
        return Ok(ValueTypeImplented::False);
    }

    //TODO: yea i know this sucks
    if value.is_i64() {
        let i = value
            .as_i64()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;

        entity.attributes.insert(key.to_string(), Int(i));

        return Ok(ValueTypeImplented::True);
    }

    if value.is_string() {
        let i = value
            .as_str()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;

        entity
            .attributes
            .insert(key.to_string(), String(i.to_string())); //TODO: should be this be a string or an &Str?

        return Ok(ValueTypeImplented::True);
    }

    if value.is_boolean() {
        let i = value
            .as_bool()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;

        entity.attributes.insert(key.to_string(), Boolean(i));

        return Ok(ValueTypeImplented::True);
    }

    return Ok(ValueTypeImplented::False);
}

fn parse_multiple_response(json: Value) -> Result<MultipleResponse<Entity>, std::string::String> {
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
            let implemented = add_attribute(&mut entity, key, value)
                .map_err(|_| "Invalid response from Dataverse".to_string())?;

            if (!implemented) {
                println!("Key: {}, implemented: {:?}", key, implemented);
            }
        }

        entities.push(entity);
    }

    let mut multi_resposne = MultipleResponse::new();

    multi_resposne.value = entities;

    Ok(multi_resposne)
}
