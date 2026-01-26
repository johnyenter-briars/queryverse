use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSqlFileAsResponse {
    pub path: String,
    pub file_name: String,
}
