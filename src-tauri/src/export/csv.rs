use powerplatform_dataverse_client::dataverse::entity::Value;

use crate::binding::model::{executesqlresponse::ExecuteSqlResponse, resultrow::ResultRow};

pub fn render_csv(result: &ExecuteSqlResponse) -> String {
    let headers = resolve_headers(result);
    let mut lines = Vec::with_capacity(result.value.len() + 1);

    lines.push(headers.iter().map(|header| escape_csv(header)).collect::<Vec<_>>().join(","));

    for row in &result.value {
        lines.push(render_row(row, &headers));
    }

    lines.join("\r\n")
}

fn resolve_headers(result: &ExecuteSqlResponse) -> Vec<String> {
    if !result.metadata.columns_order.is_empty() {
        return result
            .metadata
            .columns_order
            .iter()
            .filter(|column| column.as_str() != "__rownum")
            .cloned()
            .collect();
    }

    let mut headers: Vec<String> = Vec::new();
    for row in &result.value {
        let mut keys: Vec<String> = row
            .attributes
            .keys()
            .filter(|key| key.as_str() != "__rownum")
            .cloned()
            .collect();
        keys.sort();

        for key in keys {
            if !headers.contains(&key) {
                headers.push(key);
            }
        }
    }

    headers
}

fn render_row(row: &ResultRow, headers: &[String]) -> String {
    headers
        .iter()
        .map(|header| {
            let value = row
                .attributes
                .get(header)
                .map(value_to_string)
                .unwrap_or_default();
            escape_csv(&value)
        })
        .collect::<Vec<_>>()
        .join(",")
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::Int(value) => value.to_string(),
        Value::Float(value) => value.to_string(),
        Value::Decimal(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Boolean(value) => value.to_string(),
        Value::DateTime(value) => value.to_rfc3339(),
        Value::Guid(value) => value.to_string(),
        Value::Money(value) => value.value.to_string(),
        Value::OptionSetValue(value) => value.name.clone().unwrap_or_else(|| value.value.to_string()),
        Value::OptionSetValueCollection(value) => value
            .values
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Null => String::new(),
        Value::EntityReference(value) => value.name.clone().unwrap_or_else(|| value.id.to_string()),
    }
}

fn escape_csv(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}
