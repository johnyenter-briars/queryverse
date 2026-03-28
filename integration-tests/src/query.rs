use std::time::Duration;

use powerplatform_dataverse_client::LogLevel;
use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;
use queryverse_lib::binding::function::query::execute_sql_with_client;
use queryverse_lib::binding::model::executesqlresponse::ExecuteSqlResponse;
use queryverse_lib::binding::model::resultrow::ResultRow;

use crate::config::load_secrets;

const SQL_TIMEOUT_SECS: u64 = 180;

pub async fn create_client() -> Result<ServiceClient, String> {
    let secrets = load_secrets()?;
    ServiceClient::new(&secrets.connection_string, LogLevel::Information).await
}

pub async fn execute_sql(
    client: &ServiceClient,
    sql_text: &str,
) -> Result<ExecuteSqlResponse, String> {
    match tokio::time::timeout(
        Duration::from_secs(SQL_TIMEOUT_SECS),
        execute_sql_with_client(client, sql_text, LogLevel::Information, None),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err(format!(
            "SQL scenario timed out after {} seconds.",
            SQL_TIMEOUT_SECS
        )),
    }
}

pub fn assert_columns_present(rows: &[ResultRow], columns: &[String]) {
    if rows.is_empty() {
        return;
    }

    for row in rows {
        for column in columns {
            assert!(
                row.attributes.contains_key(column),
                "Expected column '{}' in row attributes",
                column
            );
        }
    }
}
