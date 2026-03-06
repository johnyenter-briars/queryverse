#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QVRequest<T> {
    pub value: T,
    pub request_type: RequestType,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub enum RequestType {
    Create = 0,
}
