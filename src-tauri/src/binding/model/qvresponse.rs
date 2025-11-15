#[derive(serde::Serialize)]
pub struct QVResponse<T> {
    message: String,
    success: bool,
    value: T,
}

impl QVResponse<Vec<String>> {
    pub fn new() -> Self {
        QVResponse {
            message: "foo".to_string(),
            success: true,
            value: vec![],
        }
    }
}
