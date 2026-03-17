use crate::sql::errors::ParseError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Keyword {
    Select,
    From,
    Where,
    Top,
    Distinct,
    As,
    Join,
    Inner,
    Left,
    Outer,
    On,
    Group,
    Order,
    By,
    Asc,
    Desc,
    And,
    Or,
    Not,
    Like,
    In,
    Between,
    Is,
    Null,
    True,
    False,
    Update,
    Set,
    Delete,
    Insert,
    Into,
    Values,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    Keyword(Keyword),
    Identifier(String),
    StringLiteral(String),
    Number(i64),
    Comma,
    Star,
    LParen,
    RParen,
    Dot,
    Eq,
    Neq,
    Lt,
    Lte,
    Gt,
    Gte,
    Semicolon,
    Eof,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub kind: TokenKind,
    pub line: usize,
    pub column: usize,
}

pub struct Lexer<'a> {
    input: &'a str,
    pos: usize,
    line: usize,
    column: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input,
            pos: 0,
            line: 1,
            column: 1,
        }
    }

    pub fn tokenize(&mut self) -> Result<Vec<Token>, ParseError> {
        let mut tokens = Vec::new();
        loop {
            let token = self.next_token()?;
            let is_eof = matches!(token.kind, TokenKind::Eof);
            tokens.push(token);
            if is_eof {
                break;
            }
        }
        Ok(tokens)
    }

    fn next_token(&mut self) -> Result<Token, ParseError> {
        self.skip_whitespace_and_comments()?;

        let line = self.line;
        let column = self.column;

        let current = match self.peek_char() {
            Some(ch) => ch,
            None => {
                return Ok(Token {
                    kind: TokenKind::Eof,
                    line,
                    column,
                });
            }
        };

        let kind = match current {
            ',' => {
                self.bump();
                TokenKind::Comma
            }
            '*' => {
                self.bump();
                TokenKind::Star
            }
            '(' => {
                self.bump();
                TokenKind::LParen
            }
            ')' => {
                self.bump();
                TokenKind::RParen
            }
            '.' => {
                self.bump();
                TokenKind::Dot
            }
            ';' => {
                self.bump();
                TokenKind::Semicolon
            }
            '=' => {
                self.bump();
                TokenKind::Eq
            }
            '!' => {
                self.bump();
                if self.consume_char('=') {
                    TokenKind::Neq
                } else {
                    return Err(ParseError::new("Unexpected '!'", line, column));
                }
            }
            '<' => {
                self.bump();
                if self.consume_char('=') {
                    TokenKind::Lte
                } else if self.consume_char('>') {
                    TokenKind::Neq
                } else {
                    TokenKind::Lt
                }
            }
            '>' => {
                self.bump();
                if self.consume_char('=') {
                    TokenKind::Gte
                } else {
                    TokenKind::Gt
                }
            }
            '\'' => {
                self.bump();
                let value = self.read_string_literal('\'')?;
                TokenKind::StringLiteral(value)
            }
            '[' => {
                self.bump();
                let value = self.read_bracket_identifier()?;
                TokenKind::Identifier(value)
            }
            '"' => {
                self.bump();
                let value = self.read_string_literal('"')?;
                TokenKind::Identifier(value)
            }
            ch if ch.is_ascii_digit() => {
                let value = self.read_number()?;
                TokenKind::Number(value)
            }
            ch if is_ident_start(ch) => {
                let ident = self.read_identifier();
                if let Some(keyword) = keyword_from_ident(&ident) {
                    TokenKind::Keyword(keyword)
                } else {
                    TokenKind::Identifier(ident)
                }
            }
            _ => {
                return Err(ParseError::new(
                    format!("Unexpected character '{}'.", current),
                    line,
                    column,
                ));
            }
        };

        Ok(Token { kind, line, column })
    }

    fn skip_whitespace_and_comments(&mut self) -> Result<(), ParseError> {
        loop {
            while self.peek_char().is_some_and(|ch| ch.is_whitespace()) {
                self.bump();
            }

            if self.starts_with("--") {
                while let Some(ch) = self.bump() {
                    if ch == '\n' {
                        break;
                    }
                }
                continue;
            }

            if self.starts_with("/*") {
                self.bump();
                self.bump();
                while !self.starts_with("*/") {
                    if self.bump().is_none() {
                        return Err(ParseError::new(
                            "Unterminated block comment",
                            self.line,
                            self.column,
                        ));
                    }
                }
                self.bump();
                self.bump();
                continue;
            }

            break;
        }

        Ok(())
    }

    fn read_identifier(&mut self) -> String {
        let mut value = String::new();
        while let Some(ch) = self.peek_char() {
            if is_ident_continue(ch) {
                value.push(ch);
                self.bump();
            } else {
                break;
            }
        }
        value
    }

    fn read_number(&mut self) -> Result<i64, ParseError> {
        let mut value = String::new();
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                value.push(ch);
                self.bump();
            } else {
                break;
            }
        }
        value
            .parse::<i64>()
            .map_err(|_| ParseError::new("Invalid number literal", self.line, self.column))
    }

    fn read_string_literal(&mut self, delimiter: char) -> Result<String, ParseError> {
        let mut value = String::new();
        loop {
            match self.peek_char() {
                Some(ch) if ch == delimiter => {
                    self.bump();
                    if delimiter == '\'' && self.peek_char() == Some('\'') {
                        value.push('\'');
                        self.bump();
                        continue;
                    }
                    break;
                }
                Some('\\') if delimiter == '"' => {
                    self.bump();
                    if let Some(next) = self.bump() {
                        value.push(next);
                    } else {
                        return Err(ParseError::new(
                            "Unterminated string literal",
                            self.line,
                            self.column,
                        ));
                    }
                }
                Some(ch) => {
                    value.push(ch);
                    self.bump();
                }
                None => {
                    return Err(ParseError::new(
                        "Unterminated string literal",
                        self.line,
                        self.column,
                    ));
                }
            }
        }
        Ok(value)
    }

    fn read_bracket_identifier(&mut self) -> Result<String, ParseError> {
        let mut value = String::new();
        loop {
            match self.peek_char() {
                Some(']') => {
                    self.bump();
                    break;
                }
                Some(ch) => {
                    value.push(ch);
                    self.bump();
                }
                None => {
                    return Err(ParseError::new(
                        "Unterminated bracket identifier",
                        self.line,
                        self.column,
                    ));
                }
            }
        }
        Ok(value)
    }

    fn peek_char(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }

    fn bump(&mut self) -> Option<char> {
        let ch = self.peek_char()?;
        self.pos += ch.len_utf8();
        if ch == '\n' {
            self.line += 1;
            self.column = 1;
        } else {
            self.column += 1;
        }
        Some(ch)
    }

    fn consume_char(&mut self, expected: char) -> bool {
        if self.peek_char() == Some(expected) {
            self.bump();
            true
        } else {
            false
        }
    }

    fn starts_with(&self, text: &str) -> bool {
        self.input[self.pos..].starts_with(text)
    }
}

fn is_ident_start(ch: char) -> bool {
    ch.is_ascii_alphabetic() || ch == '_'
}

fn is_ident_continue(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_'
}

fn keyword_from_ident(ident: &str) -> Option<Keyword> {
    match ident.to_ascii_uppercase().as_str() {
        "SELECT" => Some(Keyword::Select),
        "FROM" => Some(Keyword::From),
        "WHERE" => Some(Keyword::Where),
        "TOP" => Some(Keyword::Top),
        "DISTINCT" => Some(Keyword::Distinct),
        "AS" => Some(Keyword::As),
        "JOIN" => Some(Keyword::Join),
        "INNER" => Some(Keyword::Inner),
        "LEFT" => Some(Keyword::Left),
        "OUTER" => Some(Keyword::Outer),
        "ON" => Some(Keyword::On),
        "GROUP" => Some(Keyword::Group),
        "ORDER" => Some(Keyword::Order),
        "BY" => Some(Keyword::By),
        "ASC" => Some(Keyword::Asc),
        "DESC" => Some(Keyword::Desc),
        "AND" => Some(Keyword::And),
        "OR" => Some(Keyword::Or),
        "NOT" => Some(Keyword::Not),
        "LIKE" => Some(Keyword::Like),
        "IN" => Some(Keyword::In),
        "BETWEEN" => Some(Keyword::Between),
        "IS" => Some(Keyword::Is),
        "NULL" => Some(Keyword::Null),
        "TRUE" => Some(Keyword::True),
        "FALSE" => Some(Keyword::False),
        "UPDATE" => Some(Keyword::Update),
        "SET" => Some(Keyword::Set),
        "DELETE" => Some(Keyword::Delete),
        "INSERT" => Some(Keyword::Insert),
        "INTO" => Some(Keyword::Into),
        "VALUES" => Some(Keyword::Values),
        _ => None,
    }
}
