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
    if columns_order.is_empty() {
        return;
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

    if name_columns.is_empty() {
        return;
    }

    for row in rows.iter_mut() {
        for (name_column, base_column) in &name_columns {
            let should_fill = match row.attributes.get(name_column) {
                None => true,
                Some(Value::Null) => true,
                _ => false,
            };
            if !should_fill {
                continue;
            }

            if let Some(Value::EntityReference(reference)) = row.attributes.get(base_column) {
                if let Some(name) = &reference.name {
                    row.attributes
                        .insert(name_column.clone(), Value::String(name.clone()));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use powerplatform_dataverse_client::dataverse::entity::{EntityReference, Value};
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

        assert_eq!(
            rows[0].attributes.get("modifiedbyname"),
            Some(&Value::String("Jane Doe".to_string()))
        );
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

        assert_eq!(
            rows[0].attributes.get("owneridname"),
            Some(&Value::String("Existing Name".to_string()))
        );
    }
}
