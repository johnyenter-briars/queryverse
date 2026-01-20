use crate::sql_fetchxml::ast::{
    CompareOp, Expr, Literal, OrderBy, Predicate, SelectColumns, SelectStmt,
};
use crate::sql_fetchxml::errors::TranslationError;

pub fn to_fetchxml(stmt: &SelectStmt, entity_name: &str) -> Result<String, TranslationError> {
    let mut out = String::new();

    out.push_str("<fetch");
    if let Some(top) = stmt.top {
        out.push_str(&format!(" top=\"{}\"", top));
    }
    if stmt.distinct {
        out.push_str(" distinct=\"true\"");
    }
    out.push_str(">");

    out.push_str("<entity name=\"");
    out.push_str(&escape_xml(entity_name));
    out.push_str("\">");

    match &stmt.columns {
        SelectColumns::All => out.push_str("<all-attributes />"),
        SelectColumns::Columns(columns) => {
            for column in columns {
                out.push_str("<attribute name=\"");
                out.push_str(&escape_xml(&column.name));
                if let Some(alias) = &column.alias {
                    out.push_str("\" alias=\"");
                    out.push_str(&escape_xml(alias));
                }
                out.push_str("\" />");
            }
        }
    }

    if let Some(filter) = &stmt.filter {
        write_filter(filter, &mut out)?;
    }

    for order in &stmt.order_by {
        write_order(order, &mut out);
    }

    out.push_str("</entity>");
    out.push_str("</fetch>");

    Ok(out)
}

fn write_order(order: &OrderBy, out: &mut String) {
    out.push_str("<order attribute=\"");
    out.push_str(&escape_xml(&order.column));
    if order.descending {
        out.push_str("\" descending=\"true");
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
            if values.iter().any(|value| matches!(value, Literal::Null)) {
                return Err(TranslationError::new(
                    "IN list cannot contain NULL",
                ));
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
            if matches!(low, Literal::Null) || matches!(high, Literal::Null) {
                return Err(TranslationError::new(
                    "BETWEEN bounds cannot be NULL",
                ));
            }

            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated {
                "not-between"
            } else {
                "between"
            });
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
            out.push_str("<condition attribute=\"");
            out.push_str(&escape_xml(column));
            out.push_str("\" operator=\"");
            out.push_str(if *negated { "not-like" } else { "like" });
            out.push_str("\" value=\"");
            out.push_str(&escape_xml(pattern));
            out.push_str("\" />");
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
