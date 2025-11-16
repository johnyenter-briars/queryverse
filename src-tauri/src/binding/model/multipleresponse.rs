use crate::binding::model::{connection::Connection, qvresponse::QVResponse};

pub type MultipleResponse = QVResponse<Vec<String>>;

impl MultipleResponse {
    pub fn new() -> Self {
        QVResponse {
            message: "foo".to_string(),
            success: true,
            value: vec![],
        }
    }
}