use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::sql::ast::{Literal, UpdateAssignment};
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

pub(crate) fn resolve_entity_set_name(
    definitions: &[EntityDefinition],
    entity_logical: &str,
    inferred_entity_set: &str,
) -> String {
    let target_logical = normalize_ident(entity_logical);
    let target_set = normalize_ident(inferred_entity_set);

    definitions
        .iter()
        .find(|definition| {
            normalize_ident(&definition.logical_name) == target_logical
                || normalize_ident(&definition.schema_name) == target_logical
                || normalize_ident(&definition.entity_set_name) == target_logical
                || normalize_ident(&definition.entity_set_name) == target_set
        })
        .map(|definition| definition.entity_set_name.clone())
        .unwrap_or_else(|| inferred_entity_set.to_string())
}

pub(crate) fn build_update_attributes(
    assignments: &[UpdateAssignment],
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
    assignments: &[UpdateAssignment],
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

        if let Some(attribute) = matched
            && matches!(attribute.is_valid_for_update, Some(false))
        {
            invalid.push(column);
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
    if let Some((Some(table), column)) = split_qualified(raw) {
        if table.eq_ignore_ascii_case(entity) {
            return column.to_string();
        }
        if let Some(alias) = entity_alias
            && table.eq_ignore_ascii_case(alias)
        {
            return column.to_string();
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

fn literal_to_json(literal: &Literal) -> Result<JsonValue, String> {
    match literal {
        Literal::String(value) => Ok(JsonValue::String(value.clone())),
        Literal::Number(value) => Ok(JsonValue::Number((*value).into())),
        Literal::Boolean(value) => Ok(JsonValue::Bool(*value)),
        Literal::Null => Ok(JsonValue::Null),
    }
}

pub(crate) fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Int(value) => Some(value.to_string()),
        Value::Float(value) => Some(value.to_string()),
        Value::Decimal(value) => Some(value.to_string()),
        Value::Boolean(value) => Some(value.to_string()),
        Value::DateTime(value) => Some(value.to_rfc3339()),
        Value::Guid(value) => Some(value.to_string()),
        Value::Money(value) => Some(value.value.to_string()),
        Value::OptionSetValue(value) => Some(value.value.to_string()),
        Value::OptionSetValueCollection(value) => Some(format!("{:?}", value.values)),
        Value::EntityReference(reference) => Some(reference.id.to_string()),
        Value::Null => None,
    }
}

pub(crate) fn normalize_ident(value: &str) -> String {
    value
        .trim_matches(|ch| ch == '[' || ch == ']' || ch == '"' || ch == '`')
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::{
        build_update_attributes, normalize_ident, resolve_entity_set_name,
        resolve_primary_id_attribute,
        validate_update_attributes, value_to_string,
    };
    use crate::sql::ast::{Literal, UpdateAssignment};
    use powerplatform_dataverse_client::dataverse::{
        entity::{EntityReference, Value},
        entityattribute::EntityAttribute,
        entitydefinition::EntityDefinition,
    };
    use std::collections::HashMap;
    use uuid::Uuid;

    #[test]
    fn resolve_primary_id_prefers_matching_definition() {
        let definitions = vec![EntityDefinition {
            odata_context: None,
            logical_name: "account".to_string(),
            schema_name: "Account".to_string(),
            display_name: None,
            entity_set_name: "accounts".to_string(),
            is_custom_entity: false,
            is_activity: None,
            primary_id_attribute: Some("accountid".to_string()),
            extra: HashMap::new(),
        }];

        let id = resolve_primary_id_attribute(&definitions, "account", "accounts").expect("id");
        assert_eq!(id, "accountid");
    }

    #[test]
    fn resolve_primary_id_falls_back_to_logical_name() {
        let id = resolve_primary_id_attribute(&[], "contact", "contacts").expect("id");
        assert_eq!(id, "contactid");
    }

    #[test]
    fn resolve_entity_set_uses_dataverse_metadata_for_irregular_names() {
        let definitions = vec![EntityDefinition {
            odata_context: None,
            logical_name: "webresource".to_string(),
            schema_name: "WebResource".to_string(),
            display_name: None,
            entity_set_name: "webresourceset".to_string(),
            is_custom_entity: false,
            is_activity: None,
            primary_id_attribute: Some("webresourceid".to_string()),
            extra: HashMap::new(),
        }];

        assert_eq!(
            resolve_entity_set_name(&definitions, "webresource", "webresources"),
            "webresourceset"
        );
    }

    #[test]
    fn build_update_attributes_strips_base_entity_alias() {
        let assignments = vec![
            UpdateAssignment {
                column: "contact.firstname".to_string(),
                value: Literal::String("Ada".to_string()),
            },
            UpdateAssignment {
                column: "c.lastname".to_string(),
                value: Literal::String("Lovelace".to_string()),
            },
        ];

        let updates =
            build_update_attributes(&assignments, "contact", Some("c")).expect("updates");

        assert_eq!(updates.get("firstname"), Some(&serde_json::Value::String("Ada".to_string())));
        assert_eq!(updates.get("lastname"), Some(&serde_json::Value::String("Lovelace".to_string())));
    }

    #[test]
    fn validate_update_attributes_rejects_read_only_columns() {
        let assignments = vec![UpdateAssignment {
            column: "fullname".to_string(),
            value: Literal::String("Ada Lovelace".to_string()),
        }];
        let attributes = vec![EntityAttribute {
            logical_name: "fullname".to_string(),
            schema_name: "FullName".to_string(),
            attribute_type: None,
            attribute_type_name: None,
            is_custom_attribute: None,
            is_valid_odata_attribute: None,
            is_valid_for_read: None,
            is_valid_for_update: Some(false),
        }];

        let error =
            validate_update_attributes(&assignments, "contact", None, &attributes).expect_err("error");
        assert!(error.contains("fullname"));
    }

    #[test]
    fn value_to_string_handles_entity_reference_and_null() {
        let reference = Value::EntityReference(EntityReference {
            id: Uuid::nil(),
            logical_name: "contact".to_string(),
            name: Some("Ada".to_string()),
        });

        assert_eq!(value_to_string(&reference), Some(Uuid::nil().to_string()));
        assert_eq!(value_to_string(&Value::Null), None);
    }

    #[test]
    fn normalize_ident_trims_wrappers_and_lowercases() {
        assert_eq!(normalize_ident("[AccountId]"), "accountid");
        assert_eq!(normalize_ident("`CONTACT`"), "contact");
    }
}
