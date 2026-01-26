use crate::binding::model::{connection::Connection, qvresponse::QVResponse};

pub type ListConnectionsResponse = QVResponse<Vec<Connection>>;

impl ListConnectionsResponse {
    pub fn success(connections: Vec<Connection>) -> Self {
        QVResponse {
            message: "Success".to_string(),
            success: true,
            value: connections,
        }
    }
}
