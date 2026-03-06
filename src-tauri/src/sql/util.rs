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
