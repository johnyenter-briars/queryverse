mod ast;
mod errors;
mod fetchxml;
mod lexer;
mod parser;

pub use ast::{Expr, Literal, SelectStmt};
pub use errors::{ParseError, SqlError, TranslationError};

#[derive(Debug, Clone)]
pub struct FetchXmlQuery {
    pub entity_set: String,
    pub entity_logical: String,
    pub fetchxml: String,
}

pub fn parse(sql: &str) -> Result<SelectStmt, ParseError> {
    let mut parser = parser::Parser::new(sql)?;
    parser.parse_statement()
}

pub fn to_fetchxml(stmt: &SelectStmt) -> Result<FetchXmlQuery, TranslationError> {
    let entity_names = entity_names(&stmt.entity);
    let fetchxml = fetchxml::to_fetchxml(stmt, &entity_names.entity_logical)?;
    Ok(FetchXmlQuery {
        entity_set: entity_names.entity_set,
        entity_logical: entity_names.entity_logical,
        fetchxml,
    })
}

pub fn sql_to_fetchxml(sql: &str) -> Result<FetchXmlQuery, SqlError> {
    let stmt = parse(sql)?;
    Ok(to_fetchxml(&stmt)?)
}

struct EntityNames {
    entity_set: String,
    entity_logical: String,
}

fn entity_names(raw: &str) -> EntityNames {
    let normalized = raw.trim().to_ascii_lowercase();
    let logical = semantic_to_logical(&normalized);
    let entity_set = if looks_plural(&normalized) {
        normalized
    } else {
        pluralize(&normalized)
    };

    EntityNames {
        entity_set,
        entity_logical: logical,
    }
}

fn semantic_to_logical(name: &str) -> String {
    match name {
        "people" => "person".to_string(),
        "children" => "child".to_string(),
        _ => singularize(name),
    }
}

fn singularize(name: &str) -> String {
    if name.ends_with("ies") && name.len() > 3 {
        return format!("{}y", &name[..name.len() - 3]);
    }

    if ends_with_any(name, &["ses", "xes", "zes", "ches", "shes"]) && name.len() > 2 {
        return name[..name.len() - 2].to_string();
    }

    if name.ends_with('s')
        && !name.ends_with("ss")
        && !name.ends_with("us")
        && !name.ends_with("is")
        && name.len() > 1
    {
        return name[..name.len() - 1].to_string();
    }

    name.to_string()
}

fn pluralize(name: &str) -> String {
    if name.ends_with('y')
        && name.len() > 1
        && !matches!(name.chars().nth(name.len() - 2), Some('a' | 'e' | 'i' | 'o' | 'u'))
    {
        return format!("{}ies", &name[..name.len() - 1]);
    }

    if ends_with_any(name, &["s", "x", "z", "ch", "sh"]) {
        return format!("{}es", name);
    }

    format!("{}s", name)
}

fn looks_plural(name: &str) -> bool {
    if ends_with_any(name, &["ies", "ses", "xes", "zes", "ches", "shes"]) {
        return true;
    }

    if name.ends_with('s')
        && !name.ends_with("us")
        && !name.ends_with("ss")
        && !name.ends_with("is")
        && name.len() > 1
    {
        return true;
    }

    false
}

fn ends_with_any(name: &str, suffixes: &[&str]) -> bool {
    suffixes.iter().any(|suffix| name.ends_with(suffix))
}

#[cfg(test)]
mod tests {
    use super::sql_to_fetchxml;

    #[test]
    fn parses_simple_select() {
        let sql = "select top 5 name, accountid from account where statecode = 0";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert_eq!(result.entity_set, "accounts");
        assert_eq!(result.entity_logical, "account");
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

    #[test]
    fn maps_plural_entity_set_to_logical_name() {
        let sql = "select name from account where statecode = 0";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert_eq!(result.entity_set, "accounts");
        assert_eq!(result.entity_logical, "account");
        assert!(result.fetchxml.contains("<entity name=\"account\">"));
    }
}
