use uuid::Uuid;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Connection {
    pub id: Option<Uuid>,
    pub name: String,
    pub method: ConnectionMethod,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub enum ConnectionMethod {
    ClientSecret = 0
}