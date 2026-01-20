mod ast;
mod errors;
mod fetchxml;
mod lexer;
mod parser;

pub use ast::{Expr, Literal, SelectStmt};
pub use errors::{ParseError, SqlError, TranslationError};

#[derive(Debug, Clone)]
pub struct FetchXmlQuery {
    pub entity: String,
    pub fetchxml: String,
}

pub fn parse(sql: &str) -> Result<SelectStmt, ParseError> {
    let mut parser = parser::Parser::new(sql)?;
    parser.parse_statement()
}

pub fn to_fetchxml(stmt: &SelectStmt) -> Result<FetchXmlQuery, TranslationError> {
    let fetchxml = fetchxml::to_fetchxml(stmt)?;
    Ok(FetchXmlQuery {
        entity: stmt.entity.clone(),
        fetchxml,
    })
}

pub fn sql_to_fetchxml(sql: &str) -> Result<FetchXmlQuery, SqlError> {
    let stmt = parse(sql)?;
    Ok(to_fetchxml(&stmt)?)
}

#[cfg(test)]
mod tests {
    use super::sql_to_fetchxml;

    #[test]
    fn parses_simple_select() {
        let sql = "select top 5 name, accountid from account where statecode = 0";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert_eq!(result.entity, "account");
        assert!(result.fetchxml.contains("<fetch"));
        assert!(result.fetchxml.contains("<entity name=\"account\">"));
        assert!(result.fetchxml.contains("<attribute name=\"name\""));
        assert!(result.fetchxml.contains("<condition attribute=\"statecode\" operator=\"eq\" value=\"0\""));
    }

    #[test]
    fn parses_where_in() {
        let sql = "select * from account where statuscode in (1, 2, 3)";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("operator=\"in\""));
        assert!(result.fetchxml.contains("<value>1</value>"));
    }
}
