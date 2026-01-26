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

    pub fn validated(connection: Connection) -> Self {
        QVResponse {
            message: "Connection validated.".to_string(),
            success: true,
            value: connection,
        }
    }
}
