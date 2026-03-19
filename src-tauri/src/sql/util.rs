use powerplatform_dataverse_client::dataverse::entity::Value;

use crate::binding::model::resultrow::ResultRow;

pub const ROW_NUMBER_ATTRIBUTE: &str = "__rownum";

pub fn assign_row_numbers(rows: &mut [ResultRow]) {
    for (index, row) in rows.iter_mut().enumerate() {
        row.attributes.insert(
            ROW_NUMBER_ATTRIBUTE.to_string(),
            Value::Int((index + 1) as i64),
        );
    }
}

pub fn fill_entity_reference_names(rows: &mut [ResultRow], columns_order: &[String]) {
    for row in rows.iter_mut() {
        let companion_columns = resolve_companion_columns(&row.attributes, columns_order);
        for (companion_column, base_column, kind) in companion_columns {
            let should_fill =
                matches!(row.attributes.get(&companion_column), None | Some(Value::Null));
            if !should_fill {
                continue;
            }

            let Some(base_value) = row.attributes.get(&base_column) else {
                continue;
            };

            if let Some(value) = companion_value(base_value, kind) {
                row.attributes.insert(companion_column, Value::String(value));
            }
        }
    }
}

#[derive(Clone, Copy)]
enum CompanionKind {
    Name,
    Type,
}

fn resolve_companion_columns(
    attributes: &std::collections::HashMap<String, Value>,
    columns_order: &[String],
) -> Vec<(String, String, CompanionKind)> {
    if columns_order.is_empty() {
        return attributes
            .iter()
            .filter_map(|(column, value)| {
                if column.eq_ignore_ascii_case("name") {
                    return None;
                }

                let mut columns = Vec::new();
                if companion_value(value, CompanionKind::Name).is_some() {
                    columns.push((format!("{column}name"), column.clone(), CompanionKind::Name));
                }
                if companion_value(value, CompanionKind::Type).is_some() {
                    columns.push((format!("{column}type"), column.clone(), CompanionKind::Type));
                }
                if columns.is_empty() {
                    None
                } else {
                    Some(columns)
                }
            })
            .flatten()
            .collect();
    }

    let mut companion_columns: Vec<(String, String, CompanionKind)> = Vec::new();
    for column in columns_order {
        if column.eq_ignore_ascii_case("name") {
            continue;
        }
        if let Some(base) = column.strip_suffix("name") {
            if base.is_empty() {
                continue;
            }
            companion_columns.push((column.clone(), base.to_string(), CompanionKind::Name));
            continue;
        }
        if let Some(base) = column.strip_suffix("type") {
            if base.is_empty() {
                continue;
            }
            companion_columns.push((column.clone(), base.to_string(), CompanionKind::Type));
        }
    }
    companion_columns
}

fn companion_value(value: &Value, kind: CompanionKind) -> Option<String> {
    match (value, kind) {
        (Value::EntityReference(reference), CompanionKind::Name) => reference.name.clone(),
        (Value::EntityReference(reference), CompanionKind::Type) => {
            Some(reference.logical_name.clone())
        }
        (Value::OptionSetValue(value), CompanionKind::Name) => value.name.clone(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use powerplatform_dataverse_client::dataverse::entity::{
        EntityReference, OptionSetValue, Value,
    };
    use uuid::Uuid;

    use crate::binding::model::resultrow::ResultRow;
    use crate::sql::util::fill_entity_reference_names;

    #[test]
    fn fills_requested_entity_reference_name() {
        let mut attributes = HashMap::new();
        attributes.insert(
            "modifiedby".to_string(),
            Value::EntityReference(EntityReference {
                id: Uuid::nil(),
                logical_name: "systemuser".to_string(),
                name: Some("Jane Doe".to_string()),
            }),
        );
        attributes.insert("modifiedbyname".to_string(), Value::Null);
        let mut rows = vec![ResultRow { attributes }];

        fill_entity_reference_names(&mut rows, &[String::from("modifiedbyname")]);

        assert!(matches!(
            rows[0].attributes.get("modifiedbyname"),
            Some(Value::String(value)) if value == "Jane Doe"
        ));
    }

    #[test]
    fn does_not_overwrite_existing_name_value() {
        let mut attributes = HashMap::new();
        attributes.insert(
            "ownerid".to_string(),
            Value::EntityReference(EntityReference {
                id: Uuid::nil(),
                logical_name: "systemuser".to_string(),
                name: Some("Should Not Use".to_string()),
            }),
        );
        attributes.insert(
            "owneridname".to_string(),
            Value::String("Existing Name".to_string()),
        );
        let mut rows = vec![ResultRow { attributes }];

        fill_entity_reference_names(&mut rows, &[String::from("owneridname")]);

        assert!(matches!(
            rows[0].attributes.get("owneridname"),
            Some(Value::String(value)) if value == "Existing Name"
        ));
    }

    #[test]
    fn fills_select_star_name_columns_from_option_sets() {
        let mut attributes = HashMap::new();
        attributes.insert(
            "accountclassificationcode".to_string(),
            Value::OptionSetValue(OptionSetValue {
                value: 1,
                name: Some("Preferred Customer".to_string()),
            }),
        );
        let mut rows = vec![ResultRow { attributes }];

        fill_entity_reference_names(&mut rows, &[]);

        assert!(matches!(
            rows[0].attributes.get("accountclassificationcodename"),
            Some(Value::String(value)) if value == "Preferred Customer"
        ));
    }

    #[test]
    fn fills_entity_reference_type_columns() {
        let mut attributes = HashMap::new();
        attributes.insert(
            "ownerid".to_string(),
            Value::EntityReference(EntityReference {
                id: Uuid::nil(),
                logical_name: "systemuser".to_string(),
                name: Some("Jane Doe".to_string()),
            }),
        );
        let mut rows = vec![ResultRow { attributes }];

        fill_entity_reference_names(&mut rows, &[]);

        assert!(matches!(
            rows[0].attributes.get("owneridtype"),
            Some(Value::String(value)) if value == "systemuser"
        ));
    }
}
