use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::sql;
use powerplatform_dataverse_client::dataverse::{
    entity::Value, entityattribute::EntityAttribute, entitydefinition::EntityDefinition,
};

pub(crate) fn resolve_primary_id_attribute(
    definitions: &[EntityDefinition],
    entity_logical: &str,
    entity_set: &str,
) -> Result<String, String> {
    let target_logical = normalize_ident(entity_logical);
    let target_set = normalize_ident(entity_set);

    let matched = definitions.iter().find(|definition| {
        normalize_ident(&definition.logical_name) == target_logical
            || normalize_ident(&definition.schema_name) == target_logical
            || normalize_ident(&definition.entity_set_name) == target_logical
            || normalize_ident(&definition.entity_set_name) == target_set
    });

    Ok(matched
        .and_then(|definition| definition.primary_id_attribute.clone())
        .unwrap_or_else(|| format!("{}id", entity_logical)))
}

pub(crate) fn build_update_attributes(
    assignments: &[sql::UpdateAssignment],
    entity: &str,
    entity_alias: Option<&str>,
) -> Result<HashMap<String, JsonValue>, String> {
    let mut updates: HashMap<String, JsonValue> = HashMap::new();
    for assignment in assignments {
        let column = normalize_update_column(&assignment.column, entity, entity_alias);
        let value = literal_to_json(&assignment.value)?;
        updates.insert(column, value);
    }
    Ok(updates)
}

pub(crate) fn validate_update_attributes(
    assignments: &[sql::UpdateAssignment],
    entity: &str,
    entity_alias: Option<&str>,
    attributes: &[EntityAttribute],
) -> Result<(), String> {
    let mut invalid: Vec<String> = Vec::new();

    for assignment in assignments {
        let column = normalize_update_column(&assignment.column, entity, entity_alias);
        let normalized = normalize_ident(&column);
        let matched = attributes.iter().find(|attribute| {
            normalize_ident(&attribute.logical_name) == normalized
                || normalize_ident(&attribute.schema_name) == normalized
        });

        if let Some(attribute) = matched {
            if matches!(attribute.is_valid_for_update, Some(false)) {
                invalid.push(column);
            }
        }
    }

    if invalid.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "UPDATE cannot modify read-only attributes: {}.",
            invalid.join(", ")
        ))
    }
}

fn normalize_update_column(raw: &str, entity: &str, entity_alias: Option<&str>) -> String {
    if let Some((table, column)) = split_qualified(raw) {
        if let Some(table) = table {
            if table.eq_ignore_ascii_case(entity) {
                return column.to_string();
            }
            if let Some(alias) = entity_alias {
                if table.eq_ignore_ascii_case(alias) {
                    return column.to_string();
                }
            }
        }
    }
    raw.to_string()
}

fn split_qualified(value: &str) -> Option<(Option<&str>, &str)> {
    let mut parts = value.split('.');
    let first = parts.next()?;
    let second = parts.next();
    if let Some(second) = second {
        Some((Some(first), second))
    } else {
        Some((None, first))
    }
}

fn literal_to_json(literal: &sql::Literal) -> Result<JsonValue, String> {
    match literal {
        sql::Literal::String(value) => Ok(JsonValue::String(value.clone())),
        sql::Literal::Number(value) => Ok(JsonValue::Number((*value).into())),
        sql::Literal::Boolean(value) => Ok(JsonValue::Bool(*value)),
        sql::Literal::Null => Ok(JsonValue::Null),
    }
}

pub(crate) fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Int(value) => Some(value.to_string()),
        Value::Float(value) => Some(value.to_string()),
        Value::Boolean(value) => Some(value.to_string()),
        Value::Null => None,
    }
}

pub(crate) fn normalize_ident(value: &str) -> String {
    value
        .trim_matches(|ch| ch == '[' || ch == ']' || ch == '"' || ch == '`')
        .to_ascii_lowercase()
}
