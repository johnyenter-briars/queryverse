use crate::sql::ast::{DeleteStmt, SelectColumns, SelectItem, SelectItemKind, SelectStmt, UpdateStmt};
use crate::sql::errors::{ParseError, SqlError, TranslationError};
use crate::sql::names;
use crate::sql::parser;
use crate::sql::types::FetchXmlQuery;

pub fn parse(sql: &str) -> Result<SelectStmt, ParseError> {
    let mut parser = parser::Parser::new(sql)?;
    parser.parse_statement()
}

pub fn parse_update(sql: &str) -> Result<UpdateStmt, ParseError> {
    let mut parser = parser::Parser::new(sql)?;
    parser.parse_update_statement()
}

pub fn parse_delete(sql: &str) -> Result<DeleteStmt, ParseError> {
    let mut parser = parser::Parser::new(sql)?;
    parser.parse_delete_statement()
}

pub fn to_fetchxml(stmt: &SelectStmt) -> Result<FetchXmlQuery, TranslationError> {
    to_fetchxml_with_lookup_bases(stmt, None)
}

pub fn to_fetchxml_with_lookup_bases(
    stmt: &SelectStmt,
    lookup_bases: Option<&std::collections::HashSet<String>>,
) -> Result<FetchXmlQuery, TranslationError> {
    let entity_names = names::entity_names(&stmt.entity);
    let translation =
        crate::sql::fetchxml::to_fetchxml(stmt, &entity_names.entity_logical, lookup_bases)?;
    Ok(FetchXmlQuery {
        entity_set: entity_names.entity_set,
        entity_logical: entity_names.entity_logical,
        fetchxml: translation.fetchxml,
        column_outputs: translation.column_outputs,
        aggregate: translation.aggregate,
    })
}

pub fn sql_to_fetchxml(sql: &str) -> Result<FetchXmlQuery, SqlError> {
    let stmt = parse(sql)?;
    Ok(to_fetchxml(&stmt)?)
}

pub fn update_to_fetchxml(
    stmt: &UpdateStmt,
    id_attribute: &str,
) -> Result<FetchXmlQuery, TranslationError> {
    let select_stmt = SelectStmt {
        columns: SelectColumns::Columns(vec![SelectItem {
            kind: SelectItemKind::Attribute(id_attribute.to_string()),
            alias: None,
        }]),
        entity: stmt.entity.clone(),
        entity_alias: stmt.entity_alias.clone(),
        joins: Vec::new(),
        top: None,
        distinct: false,
        filter: stmt.filter.clone(),
        group_by: Vec::new(),
        having: None,
        order_by: Vec::new(),
    };

    to_fetchxml(&select_stmt)
}

pub fn delete_to_fetchxml(
    stmt: &DeleteStmt,
    id_attribute: &str,
) -> Result<FetchXmlQuery, TranslationError> {
    let select_stmt = SelectStmt {
        columns: SelectColumns::Columns(vec![SelectItem {
            kind: SelectItemKind::Attribute(id_attribute.to_string()),
            alias: None,
        }]),
        entity: stmt.entity.clone(),
        entity_alias: stmt.entity_alias.clone(),
        joins: Vec::new(),
        top: None,
        distinct: false,
        filter: stmt.filter.clone(),
        group_by: Vec::new(),
        having: None,
        order_by: Vec::new(),
    };

    to_fetchxml(&select_stmt)
}
