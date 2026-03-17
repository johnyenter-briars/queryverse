use crate::sql::ast::{
    AggregateExpr, AggregateFunction, AggregateTarget, CompareOp, Expr, JoinClause, JoinType,
    Literal, OrderBy, Predicate, SelectColumns, SelectItem, SelectItemKind, SelectStmt,
};
use crate::sql::errors::TranslationError;

#[derive(Debug, Clone)]
pub struct FetchXmlTranslation {
    pub fetchxml: String,
    pub column_outputs: Vec<String>,
    pub aggregate: bool,
}

pub fn to_fetchxml(
    stmt: &SelectStmt,
    entity_name: &str,
) -> Result<FetchXmlTranslation, TranslationError> {
    let mut out = String::new();
    let aggregate_mode = select_aggregate_mode(stmt);
    let column_outputs = projection_output_names(stmt, entity_name, stmt.entity_alias.as_deref())?;
    let group_by = validate_group_by(stmt)?;
    let alias_map = build_alias_map(stmt, entity_name, aggregate_mode, &group_by)?;
    let mut written_attributes: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    out.push_str("<fetch");
    if let Some(top) = stmt.top {
        out.push_str(&format!(" top=\"{}\"", top));
    }
    if stmt.distinct {
        out.push_str(" distinct=\"true\"");
    }
    if aggregate_mode {
        out.push_str(" aggregate=\"true\"");
    }
    out.push('>');

    out.push_str("<entity name=\"");
    out.push_str(&escape_xml(entity_name));
    out.push_str("\">");

    let join_map = build_join_map(stmt);
    let mut join_attributes: std::collections::HashMap<String, Vec<SelectItem>> =
        std::collections::HashMap::new();

    match &stmt.columns {
        SelectColumns::All => {
            if aggregate_mode {
                return Err(TranslationError::new(
                    "SELECT * cannot be used with aggregate functions",
                ));
            }
            out.push_str("<all-attributes />");
        }
        SelectColumns::Columns(columns) => {
            for column in columns {
                if let SelectItemKind::Attribute(name) = &column.kind {
                    if let Some((Some(table), _attr)) = split_qualified(name)
                        && let Some(join_key) = join_map.resolve_join_key(table)
                    {
                        join_attributes
                            .entry(join_key)
                            .or_default()
                            .push(column.clone());
                        continue;
                    }

                    if column.alias.is_none() {
                        let (_, raw_attribute_name) =
                            split_qualified(name).unwrap_or((None, name.as_str()));
                        let attribute_name =
                            lookup_name_attribute(raw_attribute_name).unwrap_or(raw_attribute_name);
                        if !written_attributes.insert(attribute_name.to_string()) {
                            continue;
                        }
                    }
                }

                write_attribute(
                    column,
                    entity_name,
                    stmt.entity_alias.as_deref(),
                    aggregate_mode,
                    &group_by,
                    &mut out,
                )?;
            }
        }
    }

    for join in &stmt.joins {
        write_join(
            join,
            entity_name,
            &join_map,
            aggregate_mode,
            &group_by,
            join_attributes.remove(&join_key(join)),
            &mut out,
        )?;
    }

    if let Some(filter) = &stmt.filter {
        write_filter(filter, &mut out)?;
    }

    for order in &stmt.order_by {
        write_order(order, aggregate_mode, &alias_map, &group_by, &mut out);
    }

    out.push_str("</entity>");
    out.push_str("</fetch>");

    Ok(FetchXmlTranslation {
        fetchxml: out,
        column_outputs,
        aggregate: aggregate_mode,
    })
}

fn write_attribute(
    item: &SelectItem,
    entity_name: &str,
    entity_alias: Option<&str>,
    aggregate_mode: bool,
    group_by: &std::collections::HashSet<String>,
    out: &mut String,
) -> Result<(), TranslationError> {
    match &item.kind {
        SelectItemKind::Attribute(name) => {
            let (_, raw_attribute_name) = split_qualified(name).unwrap_or((None, name.as_str()));
            let attribute_name =
                lookup_name_attribute(raw_attribute_name).unwrap_or(raw_attribute_name);
            if aggregate_mode
                && (group_by.is_empty() || !group_by_matches_item(item, group_by))
            {
                return Err(TranslationError::new(
                    "Non-aggregate columns must appear in GROUP BY when using aggregates",
                ));
            }

            out.push_str("<attribute name=\"");
            out.push_str(&escape_xml(attribute_name));
            let display_alias = output_name(item, entity_name, entity_alias)?;
            let alias = if aggregate_mode {
                Some(groupby_fetch_alias(attribute_name, &display_alias))
            } else {
                item.alias.clone()
            };
            if let Some(alias) = &alias {
                out.push_str("\" alias=\"");
                out.push_str(&escape_xml(alias));
            }
            if aggregate_mode {
                out.push_str("\" groupby=\"true");
            }
            out.push_str("\" />");
        }
        SelectItemKind::Aggregate(aggregate) => {
            let function = aggregate.function;
            let alias = aggregate_alias(item, entity_name, entity_alias)?;
            let attribute_name = aggregate_attribute_name(aggregate, entity_name)?;

            out.push_str("<attribute name=\"");
            out.push_str(&escape_xml(&attribute_name));
            out.push_str("\" alias=\"");
            out.push_str(&escape_xml(&alias));
            out.push_str("\" aggregate=\"");
            out.push_str(aggregate_function_name(function));
            out.push_str("\" />");
        }
    }

    Ok(())
}

fn write_order(
    order: &OrderBy,
    aggregate_mode: bool,
    alias_map: &std::collections::HashMap<String, String>,
    group_by: &std::collections::HashSet<String>,
    out: &mut String,
) {
    if aggregate_mode {
        if let Some(alias) = alias_map.get(&order.column) {
            out.push_str("<order alias=\"");
            out.push_str(&escape_xml(alias));
        } else if group_by.contains(&order.column) {
            out.push_str("<order alias=\"");
            out.push_str(&escape_xml(&groupby_fetch_alias(
                &order.column,
                &order.column,
            )));
        } else {
            out.push_str("<order attribute=\"");
            out.push_str(&escape_xml(&order.column));
        }
    } else {
        out.push_str("<order attribute=\"");
        out.push_str(&escape_xml(&order.column));
    }
    if order.descending {
        out.push_str("\" descending=\"true");
    } else {
        out.push_str("\" descending=\"false");
    }
    out.push_str("\" />");
}

fn write_filter(expr: &Expr, out: &mut String) -> Result<(), TranslationError> {
    match expr {
        Expr::And(left, right) => {
            out.push_str("<filter type=\"and\">");
            write_filter_item(left, out)?;
            write_filter_item(right, out)?;
            out.push_str("</filter>");
        }
        Expr::Or(left, right) => {
            out.push_str("<filter type=\"or\">");
            write_filter_item(left, out)?;
            write_filter_item(right, out)?;
            out.push_str("</filter>");
        }
        Expr::Predicate(predicate) => {
            out.push_str("<filter type=\"and\">");
            write_condition(predicate, out)?;
            out.push_str("</filter>");
        }
    }

    Ok(())
}

fn write_filter_item(expr: &Expr, out: &mut String) -> Result<(), TranslationError> {
    match expr {
        Expr::Predicate(predicate) => write_condition(predicate, out),
        Expr::And(_, _) | Expr::Or(_, _) => write_filter(expr, out),
    }
}

fn write_condition(predicate: &Predicate, out: &mut String) -> Result<(), TranslationError> {
    match predicate {
        Predicate::Compare { column, op, value } => {
            if split_qualified(column)
                .and_then(|(table, _)| table)
                .is_some()
            {
                return Err(TranslationError::new(
                    "Qualified column names in WHERE are not supported in v1 joins",
                ));
            }
            if matches!(value, Literal::Null) {
                return Err(TranslationError::new(
                    "Use IS NULL instead of comparing to NULL",
                ));
            }
            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(compare_op_to_fetchxml(*op));
            out.push_str("\" value=\"");
            out.push_str(&escape_xml(&literal_to_string(value)));
            out.push_str("\" />");
        }
        Predicate::In {
            column,
            values,
            negated,
        } => {
            if split_qualified(column)
                .and_then(|(table, _)| table)
                .is_some()
            {
                return Err(TranslationError::new(
                    "Qualified column names in WHERE are not supported in v1 joins",
                ));
            }
            if values.iter().any(|value| matches!(value, Literal::Null)) {
                return Err(TranslationError::new("IN list cannot contain NULL"));
            }

            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated { "not-in" } else { "in" });
            out.push_str("\">");

            for value in values {
                out.push_str("<value>");
                out.push_str(&escape_xml(&literal_to_string(value)));
                out.push_str("</value>");
            }

            out.push_str("</condition>");
        }
        Predicate::Between {
            column,
            low,
            high,
            negated,
        } => {
            if split_qualified(column)
                .and_then(|(table, _)| table)
                .is_some()
            {
                return Err(TranslationError::new(
                    "Qualified column names in WHERE are not supported in v1 joins",
                ));
            }
            if matches!(low, Literal::Null) || matches!(high, Literal::Null) {
                return Err(TranslationError::new("BETWEEN bounds cannot be NULL"));
            }

            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated { "not-between" } else { "between" });
            out.push_str("\">");

            out.push_str("<value>");
            out.push_str(&escape_xml(&literal_to_string(low)));
            out.push_str("</value>");
            out.push_str("<value>");
            out.push_str(&escape_xml(&literal_to_string(high)));
            out.push_str("</value>");
            out.push_str("</condition>");
        }
        Predicate::IsNull { column, negated } => {
            if split_qualified(column)
                .and_then(|(table, _)| table)
                .is_some()
            {
                return Err(TranslationError::new(
                    "Qualified column names in WHERE are not supported in v1 joins",
                ));
            }
            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated { "not-null" } else { "null" });
            out.push_str("\" />");
        }
        Predicate::Like {
            column,
            pattern,
            negated,
        } => {
            if split_qualified(column)
                .and_then(|(table, _)| table)
                .is_some()
            {
                return Err(TranslationError::new(
                    "Qualified column names in WHERE are not supported in v1 joins",
                ));
            }
            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated { "not-like" } else { "like" });
            out.push_str("\" value=\"");
            out.push_str(&escape_xml(pattern));
            out.push_str("\" />");
        }
        Predicate::ColumnCompare { .. } => {
            return Err(TranslationError::new(
                "Column-to-column predicates are only supported in JOIN conditions",
            ));
        }
    }

    Ok(())
}

fn compare_op_to_fetchxml(op: CompareOp) -> &'static str {
    match op {
        CompareOp::Eq => "eq",
        CompareOp::Ne => "ne",
        CompareOp::Lt => "lt",
        CompareOp::Lte => "le",
        CompareOp::Gt => "gt",
        CompareOp::Gte => "ge",
    }
}

fn split_qualified(value: &str) -> Option<(Option<&str>, &str)> {
    let mut parts = value.split('.');
    let first = parts.next()?;
    let second = parts.next();
    if let Some(second) = second {
        Some((Some(first), second))
    } else {
        Some((None, first))
    }
}

fn strip_base_prefix(value: &str, base_entity: &str, base_alias: Option<&str>) -> String {
    if let Some((Some(table), column)) = split_qualified(value) {
        if table.eq_ignore_ascii_case(base_entity) {
            return column.to_string();
        }
        if let Some(alias) = base_alias
            && table.eq_ignore_ascii_case(alias)
        {
            return column.to_string();
        }
    }
    value.to_string()
}

#[derive(Debug)]
struct JoinMap {
    base: String,
    base_alias: Option<String>,
    joins: Vec<(String, Option<String>)>,
}

impl JoinMap {
    fn resolve_join_key(&self, table: &str) -> Option<String> {
        let key = table.to_ascii_lowercase();
        for (name, alias) in &self.joins {
            if name.eq_ignore_ascii_case(&key) {
                return Some(name.to_ascii_lowercase());
            }
            if let Some(alias) = alias
                && alias.eq_ignore_ascii_case(&key)
            {
                return Some(name.to_ascii_lowercase());
            }
        }
        None
    }

    fn matches_base(&self, table: &str) -> bool {
        if self.base.eq_ignore_ascii_case(table) {
            return true;
        }
        if let Some(alias) = &self.base_alias
            && alias.eq_ignore_ascii_case(table)
        {
            return true;
        }
        false
    }
}

fn build_join_map(stmt: &SelectStmt) -> JoinMap {
    JoinMap {
        base: stmt.entity.to_ascii_lowercase(),
        base_alias: stmt.entity_alias.clone(),
        joins: stmt
            .joins
            .iter()
            .map(|join| (join.entity.to_ascii_lowercase(), join.alias.clone()))
            .collect(),
    }
}

fn join_key(join: &JoinClause) -> String {
    join.entity.to_ascii_lowercase()
}

fn write_join(
    join: &JoinClause,
    base_entity: &str,
    join_map: &JoinMap,
    aggregate_mode: bool,
    group_by: &std::collections::HashSet<String>,
    attributes: Option<Vec<SelectItem>>,
    out: &mut String,
) -> Result<(), TranslationError> {
    let (left_table, left_col) = split_qualified(&join.on.left)
        .and_then(|(table, col)| table.map(|table| (table, col)))
        .ok_or_else(|| TranslationError::new("JOIN condition must use qualified columns"))?;
    let (right_table, right_col) = split_qualified(&join.on.right)
        .and_then(|(table, col)| table.map(|table| (table, col)))
        .ok_or_else(|| TranslationError::new("JOIN condition must use qualified columns"))?;

    let (from, to) = if join_map.matches_base(left_table) {
        (right_col, left_col)
    } else if join_map.matches_base(right_table) {
        (left_col, right_col)
    } else {
        return Err(TranslationError::new(
            "JOIN must compare base entity to joined entity",
        ));
    };

    out.push_str("<link-entity name=\"");
    out.push_str(&escape_xml(&join.entity));
    out.push_str("\" from=\"");
    out.push_str(&escape_xml(from));
    out.push_str("\" to=\"");
    out.push_str(&escape_xml(to));
    out.push_str("\" link-type=\"");
    out.push_str(match join.join_type {
        JoinType::Inner => "inner",
        JoinType::Left => "outer",
    });
    let alias = join.alias.as_ref().unwrap_or(&join.entity);
    if !alias.is_empty() {
        out.push_str("\" alias=\"");
        out.push_str(&escape_xml(alias));
    }
    out.push_str("\">");

    if let Some(attrs) = attributes {
        for item in attrs {
            write_attribute(&item, base_entity, None, aggregate_mode, group_by, out)?;
        }
    }

    out.push_str("</link-entity>");
    Ok(())
}

fn literal_to_string(literal: &Literal) -> String {
    match literal {
        Literal::String(value) => value.clone(),
        Literal::Number(value) => value.to_string(),
        Literal::Boolean(value) => {
            if *value {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        Literal::Null => String::new(),
    }
}

fn select_has_aggregates(stmt: &SelectStmt) -> bool {
    match &stmt.columns {
        SelectColumns::All => false,
        SelectColumns::Columns(items) => items
            .iter()
            .any(|item| matches!(item.kind, SelectItemKind::Aggregate(_))),
    }
}

fn select_aggregate_mode(stmt: &SelectStmt) -> bool {
    select_has_aggregates(stmt) || !stmt.group_by.is_empty()
}

fn build_alias_map(
    stmt: &SelectStmt,
    entity_name: &str,
    aggregate_mode: bool,
    group_by: &std::collections::HashSet<String>,
) -> Result<std::collections::HashMap<String, String>, TranslationError> {
    let mut map = std::collections::HashMap::new();

    if !aggregate_mode {
        return Ok(map);
    }

    if let SelectColumns::Columns(items) = &stmt.columns {
        for item in items {
            match &item.kind {
                SelectItemKind::Attribute(name) => {
                    if group_by_matches_item(item, group_by) {
                        let display_alias =
                            output_name(item, entity_name, stmt.entity_alias.as_deref())?;
                        let fetch_alias = groupby_fetch_alias(name, &display_alias);
                        map.insert(display_alias.clone(), fetch_alias.clone());
                        map.entry(name.clone()).or_insert(fetch_alias);
                    }
                }
                SelectItemKind::Aggregate(_) => {
                    let display_alias =
                        output_name(item, entity_name, stmt.entity_alias.as_deref())?;
                    map.insert(display_alias.clone(), display_alias);
                }
            }
        }
    }

    Ok(map)
}

fn groupby_fetch_alias(column: &str, display_alias: &str) -> String {
    if display_alias == column {
        format!("col_{}", display_alias)
    } else {
        display_alias.to_string()
    }
}

fn group_by_matches_item(item: &SelectItem, group_by: &std::collections::HashSet<String>) -> bool {
    match &item.kind {
        SelectItemKind::Attribute(name) => {
            if group_by.contains(name) {
                return true;
            }
            match &item.alias {
                Some(alias) => group_by.contains(alias),
                None => false,
            }
        }
        SelectItemKind::Aggregate(_) => false,
    }
}

fn validate_group_by(
    stmt: &SelectStmt,
) -> Result<std::collections::HashSet<String>, TranslationError> {
    if stmt.group_by.is_empty() {
        return Ok(std::collections::HashSet::new());
    }

    let mut remaining: std::collections::HashSet<String> = stmt.group_by.iter().cloned().collect();

    match &stmt.columns {
        SelectColumns::All => {
            return Err(TranslationError::new(
                "GROUP BY requires explicit column list in SELECT",
            ));
        }
        SelectColumns::Columns(items) => {
            for item in items {
                if let SelectItemKind::Attribute(name) = &item.kind {
                    let mut matched = false;
                    if remaining.remove(name) {
                        matched = true;
                    }
                    if let Some(alias) = &item.alias
                        && remaining.remove(alias)
                    {
                        matched = true;
                    }

                    if matched {
                        continue;
                    }
                }
            }
        }
    }

    if !remaining.is_empty() {
        return Err(TranslationError::new(
            "GROUP BY columns must appear in the SELECT list",
        ));
    }

    Ok(stmt.group_by.iter().cloned().collect())
}

fn projection_output_names(
    stmt: &SelectStmt,
    entity_name: &str,
    entity_alias: Option<&str>,
) -> Result<Vec<String>, TranslationError> {
    match &stmt.columns {
        SelectColumns::All => Ok(Vec::new()),
        SelectColumns::Columns(items) => items
            .iter()
            .map(|item| output_name(item, entity_name, entity_alias))
            .collect(),
    }
}

fn output_name(
    item: &SelectItem,
    entity_name: &str,
    entity_alias: Option<&str>,
) -> Result<String, TranslationError> {
    if let Some(alias) = &item.alias {
        return Ok(alias.clone());
    }

    match &item.kind {
        SelectItemKind::Attribute(name) => Ok(strip_base_prefix(name, entity_name, entity_alias)),
        SelectItemKind::Aggregate(aggregate) => Ok(default_aggregate_alias(aggregate)),
    }
}

fn aggregate_alias(
    item: &SelectItem,
    entity_name: &str,
    entity_alias: Option<&str>,
) -> Result<String, TranslationError> {
    output_name(item, entity_name, entity_alias)
}

fn default_aggregate_alias(aggregate: &AggregateExpr) -> String {
    let function = aggregate_function_name(aggregate.function);
    match &aggregate.target {
        AggregateTarget::Star => function.to_string(),
        AggregateTarget::Column(column) => format!("{}_{}", function, column),
    }
}

fn aggregate_attribute_name(
    aggregate: &AggregateExpr,
    entity_name: &str,
) -> Result<String, TranslationError> {
    match &aggregate.target {
        AggregateTarget::Column(column) => Ok(column.clone()),
        AggregateTarget::Star => match aggregate.function {
            AggregateFunction::Count => Ok(infer_primary_id(entity_name)),
            _ => Err(TranslationError::new(
                "Only COUNT(*) is supported for star aggregates",
            )),
        },
    }
}

fn infer_primary_id(entity_name: &str) -> String {
    format!("{}id", entity_name)
}

fn aggregate_function_name(function: AggregateFunction) -> &'static str {
    match function {
        AggregateFunction::Min => "min",
        AggregateFunction::Max => "max",
        AggregateFunction::Count => "count",
        AggregateFunction::Sum => "sum",
        AggregateFunction::Avg => "avg",
    }
}

fn escape_xml(value: &str) -> String {
    let mut escaped = String::new();
    for ch in value.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '\'' => escaped.push_str("&apos;"),
            '"' => escaped.push_str("&quot;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn lookup_name_attribute(attribute: &str) -> Option<&str> {
    let lowered = attribute.to_ascii_lowercase();
    if lowered == "name" || !lowered.ends_with("name") {
        return None;
    }

    let base = &attribute[..attribute.len().saturating_sub(4)];
    if base.is_empty() {
        return None;
    }

    let base_lower = base.to_ascii_lowercase();
    if !base_lower.ends_with("id") && !base_lower.ends_with("by") {
        return None;
    }

    Some(base)
}
