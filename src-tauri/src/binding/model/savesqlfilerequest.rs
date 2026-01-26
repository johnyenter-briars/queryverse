use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSqlFileRequest {
    pub path: String,
    pub contents: String,
}
