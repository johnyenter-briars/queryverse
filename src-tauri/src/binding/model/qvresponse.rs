#[derive(serde::Serialize)]
pub struct QVResponse<T> {
    pub message: String,
    pub success: bool,
    pub value: T,
}
