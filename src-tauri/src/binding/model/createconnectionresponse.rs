use crate::binding::model::{connection::Connection, qvresponse::QVResponse};

pub type CreateConnectionResponse = QVResponse<Connection>;

impl CreateConnectionResponse  {
    pub fn success(connection: Connection) -> Self {
        QVResponse {
            message: "Success".to_string(),
            success: true,
            value: connection,
        }
    }
}
