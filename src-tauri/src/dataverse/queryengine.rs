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
        let mut page = 1;
        let mut paging_cookie: Option<std::string::String> = None;
        let mut entities: Vec<Entity> = vec![];

        loop {
            let fetch_with_paging =
                apply_paging(fetchxml, page, paging_cookie.as_deref())?;

            if matches!(self.log_level, LogLevel::Debug) {
                println!("FetchXML: {}", fetch_with_paging);
            }

            let mut url = format!("{}/api/data/v9.2/{}", self.base_url, entity);
            url.push_str("?fetchXml=");
            url.push_str(&urlencoding::encode(&fetch_with_paging));

            if matches!(self.log_level, LogLevel::Debug) {
                println!("Url: {:?}", url);
            }

            let resp = self
                .client
                .get(&url)
                .bearer_auth(&self.token)
                .header("Accept", "application/json")
                .header(
                    "Prefer",
                    "odata.include-annotations=\"Microsoft.Dynamics.CRM.fetchxmlpagingcookie,Microsoft.Dynamics.CRM.morerecords\"",
                )
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

            let page_entities = parse_entities_from_response(&json)?;
            entities.extend(page_entities);

            let more_records = parse_more_records(&json);
            if !more_records {
                break;
            }

            paging_cookie = extract_paging_cookie(&json);
            page += 1;
        }

        Ok(MultipleResponse {
            message: "Multiple results found".to_string(),
            success: true,
            value: entities,
        })
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

fn apply_paging(
    fetchxml: &str,
    page: i32,
    paging_cookie: Option<&str>,
) -> Result<std::string::String, std::string::String> {
    let mut updated = upsert_fetch_attr(fetchxml, "page", &page.to_string())?;
    if let Some(cookie) = paging_cookie {
        let escaped = escape_xml_attribute(cookie);
        updated = upsert_fetch_attr(&updated, "paging-cookie", &escaped)?;
    }
    Ok(updated)
}

fn upsert_fetch_attr(
    fetchxml: &str,
    name: &str,
    value: &str,
) -> Result<std::string::String, std::string::String> {
    let fetch_start = fetchxml
        .find("<fetch")
        .ok_or_else(|| "FetchXML must start with a <fetch> element".to_string())?;
    let tag_end = fetchxml[fetch_start..]
        .find('>')
        .ok_or_else(|| "FetchXML <fetch> element is not closed".to_string())?
        + fetch_start;

    let tag = &fetchxml[fetch_start..=tag_end];
    let attr_key = format!("{}=", name);
    if let Some(attr_index) = tag.find(&attr_key) {
        let quote_index = attr_index + attr_key.len();
        let quote = tag
            .as_bytes()
            .get(quote_index)
            .ok_or_else(|| format!("Invalid fetch attribute '{}'", name))?;
        if *quote != b'"' && *quote != b'\'' {
            return Err(format!("Invalid fetch attribute '{}'", name));
        }
        let quote_char = *quote as char;
        let value_start = quote_index + 1;
        let value_end = tag[value_start..]
            .find(quote_char)
            .ok_or_else(|| format!("Invalid fetch attribute '{}'", name))?
            + value_start;

        let mut replaced = std::string::String::new();
        replaced.push_str(&fetchxml[..fetch_start + value_start]);
        replaced.push_str(value);
        replaced.push_str(&fetchxml[fetch_start + value_end..]);
        return Ok(replaced);
    }

    let mut inserted = std::string::String::new();
    inserted.push_str(&fetchxml[..tag_end]);
    inserted.push(' ');
    inserted.push_str(name);
    inserted.push_str("=\"");
    inserted.push_str(value);
    inserted.push('"');
    inserted.push_str(&fetchxml[tag_end..]);
    Ok(inserted)
}

fn escape_xml_attribute(value: &str) -> std::string::String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn parse_more_records(json: &Value) -> bool {
    match json.get("@Microsoft.Dynamics.CRM.morerecords") {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value.eq_ignore_ascii_case("true"),
        _ => false,
    }
}

fn extract_paging_cookie(json: &Value) -> Option<std::string::String> {
    let cookie_element = json
        .get("@Microsoft.Dynamics.CRM.fetchxmlpagingcookie")
        .and_then(|value| value.as_str())?;
    let key = "pagingcookie=\"";
    let start = cookie_element.find(key)? + key.len();
    let end = cookie_element[start..].find('"')? + start;
    let encoded = &cookie_element[start..end];
    let decoded_once = urlencoding::decode(encoded).ok()?.into_owned();
    let decoded_twice = urlencoding::decode(&decoded_once).ok()?.into_owned();
    Some(decoded_twice)
}

fn parse_multiple_response(json: Value) -> Result<MultipleResponse<Entity>, std::string::String> {
    let entities = parse_entities_from_response(&json)?;

    Ok(MultipleResponse {
        message: "Multiple results found".to_string(),
        success: true,
        value: entities,
    })
}

fn parse_entities_from_response(json: &Value) -> Result<Vec<Entity>, std::string::String> {
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

    Ok(entities)
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
