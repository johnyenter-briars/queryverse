use crate::binding::model::qvresponse::QVResponse;

pub type MultipleResponse<T> = QVResponse<Vec<T>>;

impl<T> MultipleResponse<T> {
    pub fn new() -> Self {
        QVResponse {
            message: "foo".to_string(),
            success: true,
            value: vec![],
        }
    }
}