use crate::binding::model::{qvresponse::QVResponse, updatesqlexecuteresponse::UpdateSqlExecuteResponse};

pub type BackgroundJobResultResponse = QVResponse<UpdateSqlExecuteResponse>;
