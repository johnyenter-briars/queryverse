use crate::binding::model::{connection::Connection, qvresponse::QVResponse};

pub type ListConnectionsResponse = QVResponse<Vec<Connection>>;
