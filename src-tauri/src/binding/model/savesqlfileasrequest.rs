use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSqlFileAsRequest {
    pub contents: String,
    pub file_name: Option<String>,
}
