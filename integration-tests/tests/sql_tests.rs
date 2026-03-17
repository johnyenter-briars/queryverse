use powerplatform_dataverse_client::auth::config::AuthConfig;
use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;
use powerplatform_dataverse_client::LogLevel;

use queryverse_lib::binding::function::query::execute_sql_with_client;
use queryverse_lib::binding::model::executesqlresponse::ExecuteSqlResponse;
use queryverse_lib::binding::model::resultrow::ResultRow;

use queryverse_integration_tests::config::load_secrets;

const SQL_TIMEOUT_SECS: u64 = 180;

async fn create_client() -> Result<ServiceClient, String> {
    let secrets = load_secrets()?;

    if let Some(connection_string) = &secrets.connection_string {
        return ServiceClient::new(connection_string, LogLevel::Information).await;
    }

    let auth = secrets.auth_config()?;
    match auth {
        AuthConfig::ClientCredentials { .. } | AuthConfig::DeviceCode { .. } => {
            ServiceClient::new_with_auth(auth, LogLevel::Information).await
        }
    }
}

async fn execute_sql(client: &ServiceClient, sql_text: &str) -> Result<ExecuteSqlResponse, String> {
    match tokio::time::timeout(
        std::time::Duration::from_secs(SQL_TIMEOUT_SECS),
        execute_sql_with_client(client, sql_text, LogLevel::Information),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err(format!(
            "SQL test timed out after {} seconds.",
            SQL_TIMEOUT_SECS
        )),
    }
}

fn assert_columns_present(rows: &[ResultRow], columns: &[String]) {
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

// SQL tests: validate SQL -> results behavior over Dataverse

#[tokio::test]
async fn sql_basic_select() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select top 5 accountid, name from account order by name";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(result.metadata.columns_order, vec!["accountid", "name"]);
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}

#[tokio::test]
async fn sql_where_filter() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select top 1 accountid from account where statecode = 0";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(result.metadata.columns_order, vec!["accountid"]);
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}

#[tokio::test]
async fn sql_count_only() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select count(*) from account";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(result.metadata.columns_order, vec!["count"]);
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}

#[tokio::test]
async fn sql_group_by_base_column() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select count(*), address1_city from account group by address1_city";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(result.metadata.columns_order, vec!["count", "address1_city"]);
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}

#[tokio::test]
async fn sql_join_basic() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select top 5 account.accountid, systemuser.fullname from account inner join systemuser on account.ownerid = systemuser.systemuserid";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(
        result.metadata.columns_order,
        vec!["accountid", "systemuser.fullname"]
    );
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}

#[tokio::test]
async fn sql_join_group_by() -> Result<(), String> {
    let client = create_client().await?;
    let sql = "select count(*), systemuser.fullname from account inner join systemuser on account.ownerid = systemuser.systemuserid group by systemuser.fullname";

    let result = execute_sql(&client, sql).await?;

    assert_eq!(
        result.metadata.columns_order,
        vec!["count", "systemuser.fullname"]
    );
    assert_columns_present(&result.value, &result.metadata.columns_order);

    Ok(())
}
