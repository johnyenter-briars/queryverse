pub mod aggregate;
mod ast;
mod errors;
mod fetchxml;
mod lexer;
mod parser;
pub mod util;

pub use ast::{
    AggregateExpr, AggregateFunction, AggregateTarget, CompareOp, DeleteStmt, Expr, Literal,
    OrderBy, Predicate, PredicateTarget, SelectColumns, SelectItem, SelectItemKind, SelectStmt,
    UpdateAssignment, UpdateStmt,
};
pub use errors::{ParseError, SqlError, TranslationError};

#[derive(Debug, Clone)]
pub struct FetchXmlQuery {
    pub entity_set: String,
    pub entity_logical: String,
    pub fetchxml: String,
    pub column_outputs: Vec<String>,
    pub aggregate: bool,
}

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
    let entity_names = entity_names(&stmt.entity);
    let translation = fetchxml::to_fetchxml(stmt, &entity_names.entity_logical, lookup_bases)?;
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

pub fn resolve_entity_names(raw: &str) -> (String, String) {
    let names = entity_names(raw);
    (names.entity_set, names.entity_logical)
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
        && !matches!(
            name.chars().nth(name.len() - 2),
            Some('a' | 'e' | 'i' | 'o' | 'u')
        )
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
    use super::{parse, sql_to_fetchxml, to_fetchxml};

    #[test]
    fn parses_simple_select() {
        let sql = "select top 5 name, accountid from account where statecode = 0";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert_eq!(result.entity_set, "accounts");
        assert_eq!(result.entity_logical, "account");
        assert!(result.fetchxml.contains("<fetch"));
        assert!(result.fetchxml.contains("<entity name=\"account\">"));
        assert!(result.fetchxml.contains("<attribute name=\"name\""));
        assert!(
            result
                .fetchxml
                .contains("<condition attribute=\"statecode\" operator=\"eq\" value=\"0\"")
        );
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

    #[test]
    fn translates_count_star_as_aggregate_fetchxml() {
        let sql = "select count(*) from contact";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert_eq!(result.entity_set, "contacts");
        assert_eq!(result.entity_logical, "contact");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(result.fetchxml.contains("aggregate=\"count\""));
        assert!(result.fetchxml.contains("alias=\"count\""));
        assert!(result.fetchxml.contains("name=\"contactid\""));
        assert_eq!(result.column_outputs, vec!["count".to_string()]);
        assert!(result.aggregate);
    }

    #[test]
    fn rejects_mixing_aggregate_and_non_aggregate_columns_without_group_by() {
        let sql = "select count(*), name from contact";
        let stmt = parse(sql).expect("parse");
        let err = to_fetchxml(&stmt).expect_err("expected translation error");
        assert!(
            err.to_string()
                .contains("Non-aggregate columns must appear in GROUP BY")
        );
    }

    #[test]
    fn translates_group_by_with_aggregates() {
        let sql = "select sum(numberofemployees) as Total, count(address1_city) as Count, address1_city as City from account group by address1_city order by City";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"numberofemployees\" alias=\"Total\" aggregate=\"sum\"")
        );
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"address1_city\" alias=\"Count\" aggregate=\"count\"")
        );
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"address1_city\" alias=\"City\" groupby=\"true\"")
        );
        assert!(result.fetchxml.contains("<order alias=\"City\""));
        assert!(result.aggregate);
    }

    #[test]
    fn keeps_count_star_with_group_by() {
        let sql = "select count(*), address1_country from account group by address1_country";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"accountid\" alias=\"count\" aggregate=\"count\"")
        );
        assert!(result.fetchxml.contains(
            "attribute name=\"address1_country\" alias=\"col_address1_country\" groupby=\"true\""
        ));
        assert_eq!(
            result.column_outputs,
            vec!["count".to_string(), "address1_country".to_string()]
        );
    }

    #[test]
    fn orders_by_group_by_column_using_alias() {
        let sql = "select count(*), address1_city from account group by address1_city order by address1_city asc";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"accountid\" alias=\"count\" aggregate=\"count\"")
        );
        assert!(result.fetchxml.contains(
            "attribute name=\"address1_city\" alias=\"col_address1_city\" groupby=\"true\""
        ));
        assert!(
            result
                .fetchxml
                .contains("<order alias=\"col_address1_city\"")
        );
    }

    #[test]
    fn orders_by_aggregate_expression() {
        let sql = "select count(*), address1_stateorprovince from account group by address1_stateorprovince order by count(*) desc";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(
            result
                .fetchxml
                .contains("attribute name=\"accountid\" alias=\"count\" aggregate=\"count\"")
        );
        assert!(
            result
                .fetchxml
                .contains("<order alias=\"count\" descending=\"true\"")
        );
    }

    #[test]
    fn parses_group_by_having_queries() {
        let sql = "select count(*), regardingobjectid, activityid from email group by regardingobjectid, activityid having count(*) > 1 order by count(*) asc";
        let stmt = parse(sql).expect("parse");
        assert!(stmt.having.is_some());

        let result = to_fetchxml(&stmt).expect("fetchxml");
        assert!(result.fetchxml.contains("<fetch aggregate=\"true\""));
        assert!(result.fetchxml.contains("attribute name=\"emailid\" alias=\"count\" aggregate=\"count\""));
    }

    #[test]
    fn translates_inner_join_to_link_entity() {
        let sql = "select systemuser.fullname, account.accountid from account inner join systemuser on systemuser.systemuserid = account.ownerid";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<entity name=\"account\">"));
        assert!(result.fetchxml.contains("link-entity name=\"systemuser\""));
        assert!(result.fetchxml.contains("from=\"systemuserid\""));
        assert!(result.fetchxml.contains("to=\"ownerid\""));
        assert!(result.fetchxml.contains("link-type=\"inner\""));
        assert!(result.fetchxml.contains("attribute name=\"fullname\""));
        assert!(result.fetchxml.contains("attribute name=\"accountid\""));
        assert_eq!(
            result.column_outputs,
            vec!["systemuser.fullname".to_string(), "accountid".to_string()]
        );
    }

    #[test]
    fn translates_left_join_to_outer_link_entity() {
        let sql = "select account.accountid, contact.fullname from account left join contact on contact.parentcustomerid = account.accountid";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<entity name=\"account\">"));
        assert!(result.fetchxml.contains("link-entity name=\"contact\""));
        assert!(result.fetchxml.contains("from=\"parentcustomerid\""));
        assert!(result.fetchxml.contains("to=\"accountid\""));
        assert!(result.fetchxml.contains("link-type=\"outer\""));
        assert!(result.fetchxml.contains("attribute name=\"accountid\""));
        assert!(result.fetchxml.contains("attribute name=\"fullname\""));
    }

    #[test]
    fn translates_left_outer_join_to_outer_link_entity() {
        let sql = "select account.accountid from account left outer join contact on contact.parentcustomerid = account.accountid";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("link-type=\"outer\""));
    }

    #[test]
    fn selects_lookup_name_via_base_attribute() {
        let sql = "select owneridname from account";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<attribute name=\"ownerid\""));
        assert_eq!(result.column_outputs, vec!["owneridname".to_string()]);
    }

    #[test]
    fn selects_modifiedby_name_via_base_attribute() {
        let sql = "select modifiedbyname from account";
        let result = sql_to_fetchxml(sql).expect("fetchxml");
        assert!(result.fetchxml.contains("<attribute name=\"modifiedby\""));
        assert_eq!(result.column_outputs, vec!["modifiedbyname".to_string()]);
    }

    #[test]
    fn does_not_duplicate_lookup_attribute_when_name_selected() {
        let sql = "select contactid, parentcustomerid, parentcustomeridname from contact";
        let result = sql_to_fetchxml(sql).expect("fetchxml");

        let count = result
            .fetchxml
            .matches("attribute name=\"parentcustomerid\"")
            .count();
        assert_eq!(count, 1);
    }
}
