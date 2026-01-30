use std::collections::HashMap;

use reqwest::Client;
use serde_json::Value;

use crate::binding::model::dataverse::entity::Value::{Boolean, Float, Int, Null, String};
use crate::binding::model::dataverse::entity::{Attribute, Entity, Value as RowValue};
use crate::binding::model::dataverse::entityattribute::EntityAttribute;
use crate::binding::model::dataverse::entitydefinition::EntityDefinition;
use crate::binding::model::response::MultipleResponse;
use crate::LogLevel;

#[derive(Debug, serde::Deserialize)]
struct ODataList<T> {
    value: Vec<T>,
}

pub struct QueryEngine {
    client: Client,
    base_url: std::string::String,
    token: std::string::String,
    log_level: LogLevel,
}

impl QueryEngine {
    pub fn new(base_url: &str, token: &str, log_level: LogLevel) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            log_level,
        }
    }

    pub async fn _get_entity_metadata(
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
        if matches!(self.log_level, LogLevel::Debug) {
            println!("FetchXML: {}", fetchxml);
        }

        let mut url = format!("{}/api/data/v9.2/{}", self.base_url, entity);
        url.push_str("?fetchXml=");
        url.push_str(&urlencoding::encode(fetchxml));

        if matches!(self.log_level, LogLevel::Debug) {
            println!("Url: {:?}", url);
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

        if matches!(self.log_level, LogLevel::Debug) {
            println!("Raw data: {:?}", json);
        }

        parse_multiple_response(json)
    }

    pub async fn list_entity_definitions(
        &self,
    ) -> Result<Vec<EntityDefinition>, std::string::String> {
        let url = format!(
            "{}/api/data/v9.2/EntityDefinitions?$select=LogicalName,SchemaName,DisplayName,EntitySetName,IsCustomEntity,PrimaryIdAttribute",
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

    pub async fn list_entity_attributes(
        &self,
        logical_name: &str,
    ) -> Result<Vec<EntityAttribute>, std::string::String> {
        let logical = logical_name.replace('\'', "''");
        let url = format!(
            "{}/api/data/v9.2/EntityDefinitions(LogicalName='{}')/Attributes?$select=LogicalName,SchemaName,AttributeType,IsCustomAttribute,IsValidODataAttribute,IsValidForRead&$filter=IsValidODataAttribute eq true and IsValidForRead eq true",
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

        let parsed: ODataList<EntityAttribute> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))?;

        Ok(parsed.value)
    }
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
            let implemented = add_attribute(&mut entity.attributes, key, value)
                .map_err(|_| "Invalid response from Dataverse".to_string())?;

            if !implemented {
                println!("Key: {}, implemented: {:?}", key, implemented);
            }
        }

        entities.push(entity);
    }

    Ok(MultipleResponse {
        message: "Multiple results found".to_string(),
        success: true,
        value: entities,
    })
}

fn add_attribute(
    attributes: &mut HashMap<Attribute, RowValue>,
    key: &str,
    value: &Value,
) -> Result<bool, std::string::String> {
    if value.is_null() {
        attributes.insert(key.to_string(), Null);
        return Ok(true);
    }

    if value.is_i64() {
        let i = value
            .as_i64()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;
        attributes.insert(key.to_string(), Int(i));
        return Ok(true);
    }

    if value.is_u64() {
        let i = value
            .as_u64()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;
        if let Ok(as_i64) = i64::try_from(i) {
            attributes.insert(key.to_string(), Int(as_i64));
        } else {
            attributes.insert(key.to_string(), Float(i as f64));
        }
        return Ok(true);
    }

    if value.is_f64() {
        let f = value
            .as_f64()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;
        attributes.insert(key.to_string(), Float(f));
        return Ok(true);
    }

    if value.is_string() {
        let s = value
            .as_str()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;
        attributes.insert(key.to_string(), String(s.to_string()));
        return Ok(true);
    }

    if value.is_boolean() {
        let b = value
            .as_bool()
            .ok_or(format!("Unable to parse dataverse value: {:?}", value))?;
        attributes.insert(key.to_string(), Boolean(b));
        return Ok(true);
    }

    Ok(true)
}
