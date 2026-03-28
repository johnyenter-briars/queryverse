use std::future::Future;
use std::pin::Pin;

use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;

use crate::query::{assert_columns_present, execute_sql};

pub fn run(client: &ServiceClient) -> Pin<Box<dyn Future<Output = Result<(), String>> + '_>> {
    Box::pin(async move {
        let sql = "select count(*) from account";

        let result = execute_sql(client, sql).await?;

        assert_eq!(result.metadata.columns_order, vec!["count"]);
        assert_columns_present(&result.value, &result.metadata.columns_order);
        Ok(())
    })
}
