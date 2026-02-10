use std::collections::HashMap;

use powerplatform_dataverse_client::dataverse::entity::{Entity, Value};

use crate::binding::model::resultrow::ResultRow;
use crate::sql::{
    AggregateFunction, AggregateTarget, SelectColumns, SelectItem, SelectItemKind, SelectStmt,
};

pub const ROW_NUMBER_ATTRIBUTE: &str = "__rownum";

pub fn entity_to_result_row(entity: Entity, columns_order: &[String]) -> ResultRow {
    let mut attributes = std::collections::HashMap::new();
    for (key, value) in entity.attributes {
        let normalized_key = if let Some(base) = key.strip_prefix("col_") {
            if attributes.contains_key(base) {
                key
            } else {
                base.to_string()
            }
        } else {
            key
        };
        attributes.insert(normalized_key, value);
    }

    ensure_columns(&mut attributes, columns_order);

    ResultRow { attributes }
}

pub fn ensure_columns(attributes: &mut HashMap<String, Value>, columns_order: &[String]) {
    for column in columns_order {
        attributes.entry(column.clone()).or_insert(Value::Null);
    }
}

pub struct AggregatePlan {
    group_columns: Vec<GroupColumn>,
    aggregates: Vec<AggregateSpec>,
}

impl AggregatePlan {
    pub fn is_count_only(&self) -> bool {
        self.group_columns.is_empty()
            && self.aggregates.len() == 1
            && self.aggregates[0].function == AggregateFunction::Count
    }

    pub fn count_output(&self) -> Option<&str> {
        if self.is_count_only() {
            return Some(self.aggregates[0].output.as_str());
        }
        None
    }

    fn required_columns(&self) -> Vec<String> {
        let mut columns: Vec<String> = self
            .group_columns
            .iter()
            .map(|column| column.source.clone())
            .collect();

        for aggregate in &self.aggregates {
            if let Some(target) = &aggregate.target {
                if !columns.contains(target) {
                    columns.push(target.clone());
                }
            }
        }

        columns
    }
}

pub fn aggregate_fallback_plan(stmt: &SelectStmt) -> Option<AggregatePlan> {
    let items = match &stmt.columns {
        SelectColumns::Columns(items) => items,
        _ => return None,
    };

    let has_aggregate = items
        .iter()
        .any(|item| matches!(item.kind, SelectItemKind::Aggregate(_)));
    if !has_aggregate {
        return None;
    }

    let mut group_columns: Vec<GroupColumn> = Vec::new();
    let mut aggregates: Vec<AggregateSpec> = Vec::new();

    for item in items {
        match &item.kind {
            SelectItemKind::Attribute(name) => {
                let display = item.alias.clone().unwrap_or_else(|| name.clone());
                let matches_group = stmt.group_by.iter().any(|group| {
                    group == name || item.alias.as_ref().is_some_and(|alias| alias == group)
                });
                if !matches_group {
                    return None;
                }
                group_columns.push(GroupColumn {
                    source: name.clone(),
                    output: display,
                });
            }
            SelectItemKind::Aggregate(aggregate) => {
                let output = aggregate_output_name(item);
                let target = match &aggregate.target {
                    AggregateTarget::Star => None,
                    AggregateTarget::Column(column) => Some(column.clone()),
                };
                aggregates.push(AggregateSpec {
                    function: aggregate.function,
                    target,
                    output,
                });
            }
        }
    }

    Some(AggregatePlan {
        group_columns,
        aggregates,
    })
}

fn aggregate_output_name(item: &SelectItem) -> String {
    if let Some(alias) = &item.alias {
        return alias.clone();
    }

    match &item.kind {
        SelectItemKind::Attribute(name) => name.clone(),
        SelectItemKind::Aggregate(aggregate) => {
            let function = match aggregate.function {
                AggregateFunction::Min => "min",
                AggregateFunction::Max => "max",
                AggregateFunction::Count => "count",
                AggregateFunction::Sum => "sum",
                AggregateFunction::Avg => "avg",
            };
            match &aggregate.target {
                AggregateTarget::Star => function.to_string(),
                AggregateTarget::Column(column) => format!("{}_{}", function, column),
            }
        }
    }
}

pub fn demote_count_fetchxml(fetchxml: &str) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" aggregate=\"count\"", "");
    Ok(updated)
}

pub fn demote_aggregate_fetchxml(fetchxml: &str, plan: &AggregatePlan) -> Result<String, String> {
    let mut updated = fetchxml.replace(" aggregate=\"true\"", "");
    updated = updated.replace(" groupby=\"true\"", "");
    updated = strip_aggregate_attributes(&updated)?;
    ensure_attributes(&updated, &plan.required_columns())
}

fn strip_aggregate_attributes(fetchxml: &str) -> Result<String, String> {
    let mut output = String::new();
    let mut remaining = fetchxml;

    loop {
        let start = match remaining.find("<attribute") {
            Some(pos) => pos,
            None => {
                output.push_str(remaining);
                break;
            }
        };

        output.push_str(&remaining[..start]);
        let attr_end = remaining[start..]
            .find("/>")
            .ok_or_else(|| "Invalid FetchXML attribute tag".to_string())?
            + start
            + 2;
        let attr_block = &remaining[start..attr_end];
        if !attr_block.contains("aggregate=\"") {
            output.push_str(attr_block);
        }

        remaining = &remaining[attr_end..];
    }

    Ok(output)
}

fn ensure_attributes(fetchxml: &str, columns: &[String]) -> Result<String, String> {
    if columns.is_empty() {
        return Ok(fetchxml.to_string());
    }

    let mut missing: Vec<String> = Vec::new();
    for column in columns {
        let needle_double = format!("name=\"{}\"", column);
        let needle_single = format!("name='{}'", column);
        if !fetchxml.contains(&needle_double) && !fetchxml.contains(&needle_single) {
            missing.push(column.clone());
        }
    }

    if missing.is_empty() {
        return Ok(fetchxml.to_string());
    }

    let entity_start = fetchxml
        .find("<entity")
        .ok_or_else(|| "FetchXML must contain an <entity> element".to_string())?;
    let entity_end = fetchxml[entity_start..]
        .find('>')
        .ok_or_else(|| "FetchXML <entity> element is not closed".to_string())?
        + entity_start;

    let mut inserted = String::new();
    inserted.push_str(&fetchxml[..=entity_end]);
    for column in missing {
        inserted.push_str("<attribute name=\"");
        inserted.push_str(&xml_escape(&column));
        inserted.push_str("\" />");
    }
    inserted.push_str(&fetchxml[entity_end + 1..]);
    Ok(inserted)
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn aggregate_rows(
    entities: Vec<Entity>,
    plan: &AggregatePlan,
    columns_order: &[String],
) -> Vec<ResultRow> {
    let mut groups: HashMap<Vec<String>, AggregateGroup> = HashMap::new();

    for entity in entities {
        let mut key_parts: Vec<String> = Vec::new();
        let mut group_values: HashMap<String, Value> = HashMap::new();
        

        for column in &plan.group_columns {
            let value = get_entity_value(&entity, &column.source);
            key_parts.push(value_key(&value));
            group_values.entry(column.output.clone()).or_insert(value);
        }

        let entry = groups
            .entry(key_parts)
            .or_insert_with(|| AggregateGroup::new(group_values, &plan.aggregates));

        entry.update(&entity);
    }

    let mut rows: Vec<ResultRow> = Vec::with_capacity(groups.len());
    let mut row_number = 1i64;
    for (_, group) in groups {
        let mut attributes = group.finalize();
        attributes.insert(ROW_NUMBER_ATTRIBUTE.to_string(), Value::Int(row_number));
        ensure_columns(&mut attributes, columns_order);
        rows.push(ResultRow { attributes });
        row_number += 1;
    }

    rows
}

struct GroupColumn {
    source: String,
    output: String,
}

struct AggregateSpec {
    function: AggregateFunction,
    target: Option<String>,
    output: String,
}

struct AggregateAccumulator {
    output: String,
    function: AggregateFunction,
    target: Option<String>,
    count: i64,
    sum: f64,
    sum_is_int: bool,
    min: Option<Value>,
    max: Option<Value>,
    numeric_count: i64,
}

impl AggregateAccumulator {
    fn new(spec: &AggregateSpec) -> Self {
        Self {
            output: spec.output.clone(),
            function: spec.function,
            target: spec.target.clone(),
            count: 0,
            sum: 0.0,
            sum_is_int: true,
            min: None,
            max: None,
            numeric_count: 0,
        }
    }

    fn update(&mut self, entity: &Entity) {
        match self.function {
            AggregateFunction::Count => {
                if let Some(target) = &self.target {
                    let value = get_entity_value(entity, target);
                    if !matches!(value, Value::Null) {
                        self.count += 1;
                    }
                } else {
                    self.count += 1;
                }
            }
            AggregateFunction::Sum | AggregateFunction::Avg => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if let Some((num, is_int)) = numeric_value(&value) {
                    self.sum += num;
                    if !is_int {
                        self.sum_is_int = false;
                    }
                    self.numeric_count += 1;
                }
            }
            AggregateFunction::Min => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if matches!(value, Value::Null) {
                    return;
                }
                if let Some(current) = &self.min {
                    if compare_values(&value, current).is_lt() {
                        self.min = Some(value);
                    }
                } else {
                    self.min = Some(value);
                }
            }
            AggregateFunction::Max => {
                let Some(target) = &self.target else { return; };
                let value = get_entity_value(entity, target);
                if matches!(value, Value::Null) {
                    return;
                }
                if let Some(current) = &self.max {
                    if compare_values(&value, current).is_gt() {
                        self.max = Some(value);
                    }
                } else {
                    self.max = Some(value);
                }
            }
        }
    }

    fn finalize(&self) -> Value {
        match self.function {
            AggregateFunction::Count => Value::Int(self.count),
            AggregateFunction::Sum => {
                if self.numeric_count == 0 {
                    Value::Null
                } else if self.sum_is_int {
                    Value::Int(self.sum as i64)
                } else {
                    Value::Float(self.sum)
                }
            }
            AggregateFunction::Avg => {
                if self.numeric_count == 0 {
                    Value::Null
                } else {
                    Value::Float(self.sum / self.numeric_count as f64)
                }
            }
            AggregateFunction::Min => self.min.clone().unwrap_or(Value::Null),
            AggregateFunction::Max => self.max.clone().unwrap_or(Value::Null),
        }
    }
}

struct AggregateGroup {
    values: HashMap<String, Value>,
    accumulators: Vec<AggregateAccumulator>,
}

impl AggregateGroup {
    fn new(values: HashMap<String, Value>, specs: &[AggregateSpec]) -> Self {
        Self {
            values,
            accumulators: specs.iter().map(AggregateAccumulator::new).collect(),
        }
    }

    fn update(&mut self, entity: &Entity) {
        for acc in self.accumulators.iter_mut() {
            acc.update(entity);
        }
    }

    fn finalize(mut self) -> HashMap<String, Value> {
        for acc in &self.accumulators {
            self.values.insert(acc.output.clone(), acc.finalize());
        }
        self.values
    }
}

fn get_entity_value(entity: &Entity, key: &str) -> Value {
    entity
        .attributes
        .get(key)
        .cloned()
        .unwrap_or(Value::Null)
}

fn numeric_value(value: &Value) -> Option<(f64, bool)> {
    match value {
        Value::Int(i) => Some((*i as f64, true)),
        Value::Float(f) => Some((*f, false)),
        _ => None,
    }
}

fn value_key(value: &Value) -> String {
    match value {
        Value::Int(i) => i.to_string(),
        Value::Float(f) => f.to_string(),
        Value::String(s) => s.clone(),
        Value::Boolean(b) => b.to_string(),
        Value::Null => "null".to_string(),
    }
}

fn compare_values(left: &Value, right: &Value) -> std::cmp::Ordering {
    match (left, right) {
        (Value::Int(a), Value::Int(b)) => a.cmp(b),
        (Value::Int(a), Value::Float(b)) => {
            (*a as f64).partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
        }
        (Value::Float(a), Value::Int(b)) => {
            a.partial_cmp(&(*b as f64)).unwrap_or(std::cmp::Ordering::Equal)
        }
        (Value::Float(a), Value::Float(b)) => {
            a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
        }
        (Value::String(a), Value::String(b)) => a.cmp(b),
        (Value::Boolean(a), Value::Boolean(b)) => a.cmp(b),
        _ => value_key(left).cmp(&value_key(right)),
    }
}
