use log::{debug, error};
use powerplatform_dataverse_client::dataverse::requestparameters::RequestParameters;
use uuid::Uuid;

use crate::{
    DeleteSet,
    Database,
    auth::{
        connection::load_connections, serviceclient::get_or_create_service_client,
        settings::load_settings,
    },
    binding::model::{
        backgroundjobstatus::{BackgroundJobState, BackgroundJobStatus},
        deletesqlexecuteresponse::DeleteSqlExecuteResponse,
        deletesqljobstartresponse::DeleteSqlJobStartResponse,
        deletesqlpreviewresponse::DeleteSqlPreviewResponse,
    },
    jobs::{
        complete_delete_job, fail_job, insert_job, store_job_result_rows, update_job_progress,
    },
    sql,
};

use super::helpers::{resolve_entity_set_name, resolve_primary_id_attribute, value_to_string};
use super::metadata::get_entity_definitions_cached;
use super::writebatch::{clamp_batch_size, execute_delete_batches_with_progress};

#[tauri::command]
pub async fn prepare_delete_sql(
    window: tauri::Window,
    sql: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<DeleteSqlPreviewResponse, String> {
    if context.log_level.includes_debug() {
        debug!("SQL: {}", sql);
    }

    let stmt = sql::api::parse_delete(&sql).map_err(|e| e.to_string())?;

    if stmt.filter.is_none() {
        return Err("DELETE statements must include a WHERE clause.".to_string());
    }

    let connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| connection.id().as_ref() == Some(&connection_id))
        .ok_or("Connection not found")?;

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;

    let (inferred_entity_set, entity_logical) = sql::names::resolve_entity_names(&stmt.entity);
    let definitions =
        get_entity_definitions_cached(&service_client, &database, connection_id).await?;
    let entity_set =
        resolve_entity_set_name(&definitions, &entity_logical, &inferred_entity_set);
    let primary_id_attribute =
        resolve_primary_id_attribute(&definitions, &entity_logical, &entity_set)?;

    let fetch =
        sql::api::delete_to_fetchxml(&stmt, &primary_id_attribute).map_err(|e| e.to_string())?;

    let entities = service_client
        .retrieve_multiple_fetchxml_paging(&entity_set, &fetch.fetchxml)
        .await
        .map_err(|error| {
            error!("prepare_delete_sql retrieve_multiple_fetchxml failed: {error}");
            error
        })?;

    let mut ids: Vec<String> = Vec::new();
    for entity in entities {
        let value = entity
            .attributes
            .get(&primary_id_attribute)
            .ok_or_else(|| "Primary ID attribute missing from results".to_string())?;
        let id =
            value_to_string(value).ok_or_else(|| "Primary ID attribute was null".to_string())?;
        ids.push(id);
    }

    let token = Uuid::new_v4().to_string();
    let batch = DeleteSet {
        connection_id,
        entity_set,
        entity_logical,
        primary_id_attribute,
        ids,
    };
    let count = batch.ids.len();

    {
        let mut batches = database
            .delete_batches
            .lock()
            .map_err(|_| "Failed to lock delete state".to_string())?;
        batches.insert(token.clone(), batch);
    }

    Ok(DeleteSqlPreviewResponse {
        success: true,
        message: "Delete preview ready.".to_string(),
        count,
        token,
    })
}

#[tauri::command]
pub async fn execute_delete_sql(
    window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
    context: tauri::State<'_, crate::LaunchContext>,
) -> Result<DeleteSqlJobStartResponse, String> {
    let batch = {
        let mut batches = database
            .delete_batches
            .lock()
            .map_err(|_| "Failed to lock delete state".to_string())?;
        batches
            .remove(&token)
            .ok_or_else(|| "Delete batch not found or expired.".to_string())?
    };

    let current_connection_id = {
        let selected = database
            .selected_connection_id
            .lock()
            .map_err(|_| "Failed to lock connection state".to_string())?;
        selected.ok_or("No connection selected")?
    };

    if current_connection_id != batch.connection_id {
        return Err("Connection changed since preview; re-run the delete preview.".to_string());
    }

    let connections = load_connections()?;
    let connection = connections
        .into_iter()
        .find(|connection| connection.id().as_ref() == Some(&current_connection_id))
        .ok_or("Connection not found")?;

    let service_client =
        get_or_create_service_client(&connection, &database, context.log_level, Some(&window))
            .await?;
    let settings = load_settings().unwrap_or_default();
    let request_parameters = RequestParameters {
        bypass_business_logic_execution_custom_sync: settings
            .bypass_business_logic_execution_custom_sync,
        bypass_business_logic_execution_custom_async: settings
            .bypass_business_logic_execution_custom_async,
        bypass_custom_plugin_execution: settings.bypass_custom_plugin_execution,
        suppress_callback_registration_expander_job: settings
            .suppress_callback_registration_expander_job,
    };

    let job_id = Uuid::new_v4().to_string();
    let total = batch.ids.len();
    let batch_size = clamp_batch_size(settings.dataverse_default_batch_size);
    let total_batches = total.div_ceil(batch_size);

    insert_job(
        &database.background_jobs,
        BackgroundJobStatus {
            job_id: job_id.clone(),
            kind: "delete".to_string(),
            state: BackgroundJobState::Running,
            current_batch: 0,
            total_batches,
            processed: 0,
            total,
            message: format!("Queued delete job for {total} record(s)."),
            result: None,
        },
    )
    .await;

    let job_store = database.background_jobs.clone();
    let job_result_store = database.background_job_results.clone();
    let queued_job_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        update_job_progress(
            &job_store,
            &queued_job_id,
            BackgroundJobState::Running,
            0,
            total_batches,
            0,
            total,
            format!("Running delete job for {total} record(s) in {total_batches} batch(es)."),
        )
        .await;

        let outcome = execute_delete_batches_with_progress(
            &service_client,
            &batch,
            &request_parameters,
            batch_size,
            |processed, total, current_batch, total_batches| {
                let job_store = job_store.clone();
                let job_id = queued_job_id.clone();
                tauri::async_runtime::spawn(async move {
                    update_job_progress(
                        &job_store,
                        &job_id,
                        BackgroundJobState::Running,
                        current_batch,
                        total_batches,
                        processed,
                        total,
                        format!(
                            "Processed {processed} of {total} record(s), batch {current_batch} of {total_batches}."
                        ),
                    )
                    .await;
                });
            },
        )
        .await;

        match outcome {
            Ok((deleted, failed, errors)) => {
                let success = failed == 0;
                let message = if success {
                    format!("Deleted {} record(s).", deleted)
                } else {
                    format!("Deleted {} record(s) with {} error(s).", deleted, failed)
                };

                let response = DeleteSqlExecuteResponse {
                    success,
                    message,
                    deleted,
                    failed,
                    errors,
                };

                store_job_result_rows(
                    &job_result_store,
                    &queued_job_id,
                    crate::binding::model::backgroundjobstatus::BackgroundJobResult::Delete(
                        response.clone(),
                    ),
                )
                .await;

                complete_delete_job(&job_store, &queued_job_id, response).await;
            }
            Err(error) => {
                fail_job(
                    &job_store,
                    &queued_job_id,
                    0,
                    total_batches,
                    0,
                    total,
                    error,
                )
                .await;
            }
        }
    });

    Ok(DeleteSqlJobStartResponse {
        success: true,
        message: "Delete job queued.".to_string(),
        job_id,
    })
}

#[tauri::command]
pub async fn discard_delete_sql(
    _window: tauri::Window,
    token: String,
    database: tauri::State<'_, Database>,
) -> Result<bool, String> {
    let mut batches = database
        .delete_batches
        .lock()
        .map_err(|_| "Failed to lock delete state".to_string())?;
    Ok(batches.remove(&token).is_some())
}
