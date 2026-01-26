use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSqlFileResponse {
    pub path: String,
    pub file_name: String,
    pub contents: String,
}
