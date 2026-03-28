#[derive(Debug, Clone)]
pub struct FetchXmlQuery {
    pub entity_set: String,
    pub entity_logical: String,
    pub fetchxml: String,
    pub column_outputs: Vec<String>,
    pub aggregate: bool,
}
