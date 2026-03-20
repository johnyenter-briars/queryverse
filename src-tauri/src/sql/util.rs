use powerplatform_dataverse_client::dataverse::entity::Value;
use powerplatform_dataverse_client::dataverse::entityattribute::EntityAttribute;

use crate::binding::model::resultrow::ResultRow;
use crate::sql::ast::{JoinClause, JoinOn, JoinType};
use crate::sql::{
    CompareOp, Expr, Literal, Predicate, PredicateTarget, SelectStmt,
};

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

pub fn lookup_attribute_set(attributes: &[EntityAttribute]) -> std::collections::HashSet<String> {
    attributes
        .iter()
        .filter(|attribute| is_lookup_attribute_type(attribute))
        .map(|attribute| attribute.logical_name.to_ascii_lowercase())
        .collect()
}

pub fn filter_requires_local_companion_evaluation(
    expr: Option<&Expr>,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    expr.is_some_and(|expr| expr_requires_local_companion_evaluation(expr, lookup_attributes))
}

pub fn push_down_lookup_type_filters(
    stmt: &mut SelectStmt,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    let Some(filter) = stmt.filter.clone() else {
        return false;
    };

    let base_reference = stmt
        .entity_alias
        .clone()
        .unwrap_or_else(|| stmt.entity.clone());
    let mut alias_counter = stmt.joins.len();
    let (filter, joins, changed) =
        extract_lookup_type_joins(
            &filter,
            &base_reference,
            lookup_attributes,
            &mut alias_counter,
        );

    if !changed {
        return false;
    }

    stmt.filter = filter;
    stmt.joins.extend(joins);
    true
}

fn expr_requires_local_companion_evaluation(
    expr: &Expr,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    match expr {
        Expr::And(left, right) | Expr::Or(left, right) => {
            expr_requires_local_companion_evaluation(left, lookup_attributes)
                || expr_requires_local_companion_evaluation(right, lookup_attributes)
        }
        Expr::Predicate(predicate) => {
            predicate_requires_local_companion_evaluation(predicate, lookup_attributes)
        }
    }
}

fn extract_lookup_type_joins(
    expr: &Expr,
    base_reference: &str,
    lookup_attributes: &std::collections::HashSet<String>,
    alias_counter: &mut usize,
) -> (Option<Expr>, Vec<JoinClause>, bool) {
    match expr {
        Expr::And(left, right) => {
            let (left_expr, mut left_joins, left_changed) =
                extract_lookup_type_joins(left, base_reference, lookup_attributes, alias_counter);
            let (right_expr, right_joins, right_changed) =
                extract_lookup_type_joins(
                    right,
                    base_reference,
                    lookup_attributes,
                    alias_counter,
                );
            left_joins.extend(right_joins);

            let expr = match (left_expr, right_expr) {
                (Some(left), Some(right)) => Some(Expr::And(Box::new(left), Box::new(right))),
                (Some(left), None) => Some(left),
                (None, Some(right)) => Some(right),
                (None, None) => None,
            };

            (expr, left_joins, left_changed || right_changed)
        }
        Expr::Or(_, _) => (Some(expr.clone()), Vec::new(), false),
        Expr::Predicate(predicate) => {
            if let Some(join) = lookup_type_join_from_predicate(
                predicate,
                base_reference,
                lookup_attributes,
                alias_counter,
            ) {
                (None, vec![join], true)
            } else {
                (Some(expr.clone()), Vec::new(), false)
            }
        }
    }
}

fn lookup_type_join_from_predicate(
    predicate: &Predicate,
    base_reference: &str,
    lookup_attributes: &std::collections::HashSet<String>,
    alias_counter: &mut usize,
) -> Option<JoinClause> {
    let Predicate::Compare { left, op, value } = predicate else {
        return None;
    };

    if !matches!(op, CompareOp::Eq) {
        return None;
    }

    let PredicateTarget::Column(column) = left else {
        return None;
    };

    let Literal::String(target_entity) = value else {
        return None;
    };

    let base_column = lookup_type_base_column(column, lookup_attributes)?;
    // TODO: Compare this rewrite strategy with Sql4Cds and align if Mark handles
    // companion lookup type filters more efficiently or more correctly for
    // polymorphic lookups and complex boolean expressions.
    let alias = format!(
        "__qv_{}_{}_{}",
        sanitize_alias_fragment(&base_column),
        sanitize_alias_fragment(target_entity),
        *alias_counter
    );
    *alias_counter += 1;

    Some(JoinClause {
        join_type: JoinType::Inner,
        entity: target_entity.clone(),
        alias: Some(alias.clone()),
        on: JoinOn {
            left: format!("{base_reference}.{base_column}"),
            op: CompareOp::Eq,
            right: format!("{alias}.{}id", target_entity),
        },
    })
}

fn lookup_type_base_column(
    column: &str,
    lookup_attributes: &std::collections::HashSet<String>,
) -> Option<String> {
    if let Some((table, raw)) = column.rsplit_once('.') {
        let base = raw.strip_suffix("type")?;
        if base.is_empty() {
            return None;
        }
        let base_lower = base.to_ascii_lowercase();
        if !lookup_attributes.contains(&base_lower) {
            return None;
        }
        return Some(format!("{table}.{base}").rsplit_once('.').map(|(_, col)| col.to_string()).unwrap_or_else(|| base.to_string()));
    }

    let base = column.strip_suffix("type")?;
    if base.is_empty() {
        return None;
    }
    let base_lower = base.to_ascii_lowercase();
    if !lookup_attributes.contains(&base_lower) {
        return None;
    }
    Some(base.to_string())
}

fn sanitize_alias_fragment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect()
}

fn predicate_requires_local_companion_evaluation(
    predicate: &Predicate,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    match predicate {
        Predicate::Compare { left, .. }
        | Predicate::In { left, .. }
        | Predicate::Between { left, .. }
        | Predicate::IsNull { left, .. }
        | Predicate::Like { left, .. } => {
            target_requires_local_companion_evaluation(left, lookup_attributes)
        }
        Predicate::ColumnCompare { left, right, .. } => {
            target_requires_local_companion_evaluation(left, lookup_attributes)
                || target_requires_local_companion_evaluation(right, lookup_attributes)
        }
    }
}

fn target_requires_local_companion_evaluation(
    target: &PredicateTarget,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    match target {
        PredicateTarget::Column(name) => is_lookup_companion_column(name, lookup_attributes),
        PredicateTarget::Aggregate(_) => false,
    }
}

fn is_lookup_companion_column(
    name: &str,
    lookup_attributes: &std::collections::HashSet<String>,
) -> bool {
    let lower = name.to_ascii_lowercase();
    let suffix = if lower == "name" {
        return false;
    } else if lower.ends_with("name") {
        "name"
    } else if lower.ends_with("type") {
        "type"
    } else {
        return false;
    };

    let base = &lower[..lower.len().saturating_sub(suffix.len())];
    !base.is_empty() && lookup_attributes.contains(base)
}

fn is_lookup_attribute_type(attribute: &EntityAttribute) -> bool {
    let value = attribute
        .attribute_type_name
        .as_ref()
        .and_then(|value| value.value.as_deref())
        .or(attribute.attribute_type.as_deref())
        .unwrap_or_default()
        .to_ascii_lowercase();

    matches!(value.as_str(), "lookup" | "lookuptype" | "customer" | "customertype" | "owner" | "ownertype")
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
    use crate::sql::{
        CompareOp, Expr, Literal, Predicate, PredicateTarget,
        util::{
            fill_entity_reference_names, filter_requires_local_companion_evaluation,
            push_down_lookup_type_filters,
        },
        SelectColumns, SelectStmt,
    };

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

    #[test]
    fn detects_lookup_companion_filters() {
        let expr = Expr::Predicate(Predicate::Compare {
            left: PredicateTarget::Column("owneridtype".to_string()),
            op: CompareOp::Eq,
            value: Literal::String("systemuser".to_string()),
        });

        assert!(filter_requires_local_companion_evaluation(Some(&expr)));
    }

    #[test]
    fn rewrites_lookup_type_filter_to_join() {
        let mut stmt = SelectStmt {
            columns: SelectColumns::All,
            entity: "account".to_string(),
            entity_alias: None,
            joins: Vec::new(),
            top: Some(20),
            distinct: false,
            filter: Some(Expr::Predicate(Predicate::Compare {
                left: PredicateTarget::Column("owneridtype".to_string()),
                op: CompareOp::Eq,
                value: Literal::String("systemuser".to_string()),
            })),
            group_by: Vec::new(),
            having: None,
            order_by: Vec::new(),
        };

        assert!(push_down_lookup_type_filters(&mut stmt));
        assert!(stmt.filter.is_none());
        assert_eq!(stmt.joins.len(), 1);
        assert_eq!(stmt.joins[0].entity, "systemuser");
        assert!(stmt.joins[0].on.left.ends_with(".ownerid"));
        assert!(stmt.joins[0].on.right.ends_with(".systemuserid"));
    }
}
