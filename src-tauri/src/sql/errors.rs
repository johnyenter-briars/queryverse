use std::fmt;

#[derive(Debug, Clone)]
pub struct ParseError {
    pub message: String,
    pub line: usize,
    pub column: usize,
}

impl ParseError {
    pub fn new(message: impl Into<String>, line: usize, column: usize) -> Self {
        Self {
            message: message.into(),
            line,
            column,
        }
    }
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Parse error at line {}, column {}: {}",
            self.line, self.column, self.message
        )
    }
}

impl std::error::Error for ParseError {}

#[derive(Debug, Clone)]
pub struct TranslationError {
    pub message: String,
}

impl TranslationError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for TranslationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Translation error: {}", self.message)
    }
}

impl std::error::Error for TranslationError {}

#[derive(Debug, Clone)]
pub enum SqlError {
    Parse(ParseError),
    Translation(TranslationError),
}

impl fmt::Display for SqlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SqlError::Parse(error) => write!(f, "{}", error),
            SqlError::Translation(error) => write!(f, "{}", error),
        }
    }
}

impl std::error::Error for SqlError {}

impl From<ParseError> for SqlError {
    fn from(error: ParseError) -> Self {
        SqlError::Parse(error)
    }
}

impl From<TranslationError> for SqlError {
    fn from(error: TranslationError) -> Self {
        SqlError::Translation(error)
    }
}
