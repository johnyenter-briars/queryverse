#[derive(Debug, Clone)]
pub struct SelectStmt {
    pub columns: SelectColumns,
    pub entity: String,
    pub top: Option<u32>,
    pub distinct: bool,
    pub filter: Option<Expr>,
    pub order_by: Vec<OrderBy>,
}

#[derive(Debug, Clone)]
pub enum SelectColumns {
    All,
    Columns(Vec<SelectItem>),
}

#[derive(Debug, Clone)]
pub struct SelectItem {
    pub kind: SelectItemKind,
    pub alias: Option<String>,
}

#[derive(Debug, Clone)]
pub enum SelectItemKind {
    Attribute(String),
    Aggregate(AggregateExpr),
}

#[derive(Debug, Clone)]
pub struct AggregateExpr {
    pub function: AggregateFunction,
    pub target: AggregateTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AggregateFunction {
    Min,
    Max,
    Count,
    Sum,
    Avg,
}

#[derive(Debug, Clone)]
pub enum AggregateTarget {
    Star,
    Column(String),
}

#[derive(Debug, Clone)]
pub struct OrderBy {
    pub column: String,
    pub descending: bool,
}

#[derive(Debug, Clone)]
pub enum Expr {
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Predicate(Predicate),
}

#[derive(Debug, Clone)]
pub enum Predicate {
    Compare {
        column: String,
        op: CompareOp,
        value: Literal,
    },
    In {
        column: String,
        values: Vec<Literal>,
        negated: bool,
    },
    Between {
        column: String,
        low: Literal,
        high: Literal,
        negated: bool,
    },
    IsNull {
        column: String,
        negated: bool,
    },
    Like {
        column: String,
        pattern: String,
        negated: bool,
    },
}

#[derive(Debug, Clone, Copy)]
pub enum CompareOp {
    Eq,
    Ne,
    Lt,
    Lte,
    Gt,
    Gte,
}

#[derive(Debug, Clone)]
pub enum Literal {
    String(String),
    Number(i64),
    Boolean(bool),
    Null,
}
