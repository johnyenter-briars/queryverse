use crate::binding::model::{connectiontreeitem::ConnectionTreeItem, qvresponse::QVResponse};

pub type ListConnectionTreeResponse = QVResponse<Vec<ConnectionTreeItem>>;
