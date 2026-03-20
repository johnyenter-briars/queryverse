use powerplatform_dataverse_client::dataverse::{
    batch::{
        DeleteRequest, ExecuteMultipleRequest, ExecuteMultipleSettings, OrganizationRequest,
        UpdateRequest,
    },
    entity::{Entity, EntityReference, Value},
    requestparameters::RequestParameters,
    serviceclient::ServiceClient,
};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::{DeleteSet, UpdateSet};

pub(crate) fn clamp_batch_size(value: u32) -> usize {
    value.clamp(1, 1000) as usize
}

pub(crate) async fn execute_update_batches_with_progress<F>(
    service_client: &ServiceClient,
    batch: &UpdateSet,
    request_parameters: &RequestParameters,
    batch_size: usize,
    mut on_progress: F,
) -> Result<(usize, usize, Vec<String>), String>
where
    F: FnMut(usize, usize),
{
    let mut updated = 0usize;
    let mut failed = 0usize;
    let mut errors = Vec::new();
    let total = batch.ids.len();

    for ids in batch.ids.chunks(batch_size) {
        let mut requests = Vec::new();
        let mut request_ids = Vec::new();

        for id in ids {
            let parsed_id = match parse_record_id(id) {
                Ok(value) => value,
                Err(error) => {
                    failed += 1;
                    errors.push(format!("{id}: {error}"));
                    continue;
                }
            };

            let mut target = Entity::new(parsed_id, batch.entity_logical.clone(), None);
            target.attributes = json_attributes_to_dataverse_values(&batch.updates)?;

            let mut request = UpdateRequest::new(target);
            request.parameters = request_parameters.clone();
            requests.push(OrganizationRequest::Update(request));
            request_ids.push(id.clone());
        }

        if requests.is_empty() {
            continue;
        }

        let response = service_client
            .execute_multiple(&ExecuteMultipleRequest {
                settings: ExecuteMultipleSettings {
                    continue_on_error: true,
                    return_responses: false,
                },
                requests,
            })
            .await?;

        let batch_failures = response.responses.len();
        updated += request_ids.len().saturating_sub(batch_failures);
        failed += batch_failures;

        for item in response.responses {
            if let Some(fault) = item.fault {
                let record_id = request_ids
                    .get(item.request_index)
                    .cloned()
                    .unwrap_or_else(|| "<unknown id>".to_string());
                errors.push(format!("{record_id}: {}", fault.message));
            }
        }

        on_progress(updated + failed, total);
    }

    Ok((updated, failed, errors))
}

pub(crate) async fn execute_delete_batches(
    service_client: &ServiceClient,
    batch: &DeleteSet,
    request_parameters: &RequestParameters,
    batch_size: usize,
) -> Result<(usize, usize, Vec<String>), String> {
    let mut deleted = 0usize;
    let mut failed = 0usize;
    let mut errors = Vec::new();

    for ids in batch.ids.chunks(batch_size) {
        let mut requests = Vec::new();
        let mut request_ids = Vec::new();

        for id in ids {
            let parsed_id = match parse_record_id(id) {
                Ok(value) => value,
                Err(error) => {
                    failed += 1;
                    errors.push(format!("{id}: {error}"));
                    continue;
                }
            };

            let mut request = DeleteRequest::new(EntityReference {
                id: parsed_id,
                logical_name: batch.entity_logical.clone(),
                name: None,
            });
            request.parameters = request_parameters.clone();
            requests.push(OrganizationRequest::Delete(request));
            request_ids.push(id.clone());
        }

        if requests.is_empty() {
            continue;
        }

        let response = service_client
            .execute_multiple(&ExecuteMultipleRequest {
                settings: ExecuteMultipleSettings {
                    continue_on_error: true,
                    return_responses: false,
                },
                requests,
            })
            .await?;

        let batch_failures = response.responses.len();
        deleted += request_ids.len().saturating_sub(batch_failures);
        failed += batch_failures;

        for item in response.responses {
            if let Some(fault) = item.fault {
                let record_id = request_ids
                    .get(item.request_index)
                    .cloned()
                    .unwrap_or_else(|| "<unknown id>".to_string());
                errors.push(format!("{record_id}: {}", fault.message));
            }
        }
    }

    Ok((deleted, failed, errors))
}

fn parse_record_id(id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(id.trim_matches(|ch| ch == '{' || ch == '}'))
        .map_err(|e| format!("Invalid record id: {e}"))
}

fn json_attributes_to_dataverse_values(
    attributes: &std::collections::HashMap<String, JsonValue>,
) -> Result<std::collections::HashMap<String, Value>, String> {
    attributes
        .iter()
        .map(|(key, value)| Ok((key.clone(), json_to_dataverse_value(value)?)))
        .collect()
}

pub(crate) fn json_to_dataverse_value(value: &JsonValue) -> Result<Value, String> {
    match value {
        JsonValue::Null => Ok(Value::Null),
        JsonValue::Bool(value) => Ok(Value::Boolean(*value)),
        JsonValue::String(value) => Ok(Value::String(value.clone())),
        JsonValue::Number(value) => {
            if let Some(value) = value.as_i64() {
                Ok(Value::Int(value))
            } else if let Some(value) = value.as_f64() {
                Ok(Value::Float(value))
            } else {
                Err(format!("Unsupported numeric update value: {value}"))
            }
        }
        JsonValue::Array(_) | JsonValue::Object(_) => {
            Err("Complex JSON values are not supported in SQL UPDATE batches.".to_string())
        }
    }
}
