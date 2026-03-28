/// Canonical SELECT statement shape understood by QueryVerse's custom SQL pipeline.
///
/// This AST is intentionally narrower than full SQL: it only models the constructs we
/// can translate to FetchXML or evaluate in the local aggregate fallback path.
#[derive(Debug, Clone)]
pub struct SelectStmt {
    pub columns: SelectColumns,
    pub entity: String,
    pub entity_alias: Option<String>,
    pub joins: Vec<JoinClause>,
    pub top: Option<u32>,
    pub distinct: bool,
    pub filter: Option<Expr>,
    pub group_by: Vec<String>,
    pub having: Option<Expr>,
    pub order_by: Vec<OrderBy>,
}

/// UPDATE statement model used by the staged update-preview / execute flow.
#[derive(Debug, Clone)]
pub struct UpdateStmt {
    pub entity: String,
    pub entity_alias: Option<String>,
    pub assignments: Vec<UpdateAssignment>,
    pub filter: Option<Expr>,
}

/// Single `SET column = literal` assignment in an UPDATE statement.
#[derive(Debug, Clone)]
pub struct UpdateAssignment {
    pub column: String,
    pub value: Literal,
}

/// DELETE statement model used by the staged delete-preview / execute flow.
#[derive(Debug, Clone)]
pub struct DeleteStmt {
    pub entity: String,
    pub entity_alias: Option<String>,
    pub filter: Option<Expr>,
}

/// Join metadata captured from the SQL parser before FetchXML translation.
#[derive(Debug, Clone)]
pub struct JoinClause {
    pub join_type: JoinType,
    pub entity: String,
    pub alias: Option<String>,
    pub on: JoinOn,
}

/// Only join types that can currently be expressed against Dataverse.
#[derive(Debug, Clone, Copy)]
pub enum JoinType {
    Inner,
    Left,
}

/// Simplified join predicate model. v1 only supports a single column-to-column comparison.
#[derive(Debug, Clone)]
pub struct JoinOn {
    pub left: String,
    pub op: CompareOp,
    pub right: String,
}

/// Projection shape for the SELECT list.
#[derive(Debug, Clone)]
pub enum SelectColumns {
    All,
    Columns(Vec<SelectItem>),
}

/// One projected item in the SELECT list, optionally renamed with an alias.
#[derive(Debug, Clone)]
pub struct SelectItem {
    pub kind: SelectItemKind,
    pub alias: Option<String>,
}

/// QueryVerse supports projecting either a plain attribute or a supported aggregate.
#[derive(Debug, Clone)]
pub enum SelectItemKind {
    Attribute(String),
    Aggregate(AggregateExpr),
}

/// Aggregate expression reused across SELECT, ORDER BY, and HAVING parsing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AggregateExpr {
    pub function: AggregateFunction,
    pub target: AggregateTarget,
}

/// Aggregate functions supported by both FetchXML translation and local fallback evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AggregateFunction {
    Min,
    Max,
    Count,
    Sum,
    Avg,
}

/// Aggregate target is either `*` or a single column reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AggregateTarget {
    Star,
    Column(String),
}

/// ORDER BY item after aliases and aggregate output names have been resolved.
#[derive(Debug, Clone)]
pub struct OrderBy {
    pub column: String,
    pub descending: bool,
}

/// Boolean expression tree used by WHERE and HAVING clauses.
#[derive(Debug, Clone)]
pub enum Expr {
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Predicate(Predicate),
}

/// Supported predicate forms for QueryVerse's SQL subset.
#[derive(Debug, Clone)]
pub enum Predicate {
    Compare {
        left: PredicateTarget,
        op: CompareOp,
        value: Literal,
    },
    ColumnCompare {
        left: PredicateTarget,
        op: CompareOp,
        right: PredicateTarget,
    },
    In {
        left: PredicateTarget,
        values: Vec<Literal>,
        negated: bool,
    },
    Between {
        left: PredicateTarget,
        low: Literal,
        high: Literal,
        negated: bool,
    },
    IsNull {
        left: PredicateTarget,
        negated: bool,
    },
    Like {
        left: PredicateTarget,
        pattern: String,
        negated: bool,
    },
}

/// Left/right side of a predicate: either a column or an aggregate output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PredicateTarget {
    Column(String),
    Aggregate(AggregateExpr),
}

/// Comparison operators shared by regular predicates and JOIN conditions.
#[derive(Debug, Clone, Copy)]
pub enum CompareOp {
    Eq,
    Ne,
    Lt,
    Lte,
    Gt,
    Gte,
}

/// Literal values accepted by the parser without parameter binding.
#[derive(Debug, Clone)]
pub enum Literal {
    String(String),
    Number(i64),
    Boolean(bool),
    Null,
}
