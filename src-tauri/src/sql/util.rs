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
        let name_columns = resolve_name_columns(&row.attributes, columns_order);
        for (name_column, base_column) in name_columns {
            let should_fill =
                matches!(row.attributes.get(&name_column), None | Some(Value::Null));
            if !should_fill {
                continue;
            }

            let Some(base_value) = row.attributes.get(&base_column) else {
                continue;
            };

            if let Some(name) = value_name(base_value) {
                row.attributes.insert(name_column, Value::String(name));
            }
        }
    }
}

fn resolve_name_columns(
    attributes: &std::collections::HashMap<String, Value>,
    columns_order: &[String],
) -> Vec<(String, String)> {
    if columns_order.is_empty() {
        return attributes
            .iter()
            .filter_map(|(column, value)| {
                if column.eq_ignore_ascii_case("name") || value_name(value).is_none() {
                    return None;
                }
                Some((format!("{column}name"), column.clone()))
            })
            .collect();
    }

    let mut name_columns: Vec<(String, String)> = Vec::new();
    for column in columns_order {
        if column.eq_ignore_ascii_case("name") {
            continue;
        }
        if let Some(base) = column.strip_suffix("name") {
            if base.is_empty() {
                continue;
            }
            name_columns.push((column.clone(), base.to_string()));
        }
    }
    name_columns
}

fn value_name(value: &Value) -> Option<String> {
    match value {
        Value::EntityReference(reference) => reference.name.clone(),
        Value::OptionSetValue(value) => value.name.clone(),
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
}
