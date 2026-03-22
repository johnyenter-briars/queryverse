use powerplatform_dataverse_client::dataverse::entity::Value;
use rust_xlsxwriter::{Workbook, Worksheet};

use crate::binding::model::{executesqlresponse::ExecuteSqlResponse, resultrow::ResultRow};

pub fn build_excel_bytes(result: &ExecuteSqlResponse) -> Result<Vec<u8>, String> {
    let headers = resolve_headers(result);
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    write_headers(worksheet, &headers)?;
    write_rows(worksheet, &result.value, &headers)?;

    workbook.save_to_buffer().map_err(|error| error.to_string())
}

fn write_headers(worksheet: &mut Worksheet, headers: &[String]) -> Result<(), String> {
    for (column_index, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, column_index as u16, header)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn write_rows(
    worksheet: &mut Worksheet,
    rows: &[ResultRow],
    headers: &[String],
) -> Result<(), String> {
    for (row_index, row) in rows.iter().enumerate() {
        let excel_row = (row_index + 1) as u32;
        for (column_index, header) in headers.iter().enumerate() {
            let value = row
                .attributes
                .get(header)
                .map(value_to_string)
                .unwrap_or_default();

            worksheet
                .write_string(excel_row, column_index as u16, value)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
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
