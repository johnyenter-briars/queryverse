use crate::sql_fetchxml::ast::{
    Column, CompareOp, Expr, Literal, OrderBy, Predicate, SelectColumns, SelectStmt,
};
use crate::sql_fetchxml::errors::ParseError;
use crate::sql_fetchxml::lexer::{Keyword, Lexer, Token, TokenKind};

pub struct Parser {
    tokens: Vec<Token>,
    index: usize,
}

impl Parser {
    pub fn new(input: &str) -> Result<Self, ParseError> {
        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize()?;
        Ok(Self { tokens, index: 0 })
    }

    pub fn parse_statement(&mut self) -> Result<SelectStmt, ParseError> {
        match self.current().kind {
            TokenKind::Keyword(Keyword::Select) => self.parse_select(),
            TokenKind::Keyword(Keyword::Update)
            | TokenKind::Keyword(Keyword::Insert)
            | TokenKind::Keyword(Keyword::Delete) => Err(self.error_at_current(
                "Only SELECT queries can be converted to FetchXML in v1",
            )),
            _ => Err(self.error_at_current("Only SELECT statements are supported")),
        }
    }

    fn parse_select(&mut self) -> Result<SelectStmt, ParseError> {
        self.expect_keyword(Keyword::Select)?;

        let mut distinct = false;
        let mut top = None;

        loop {
            if self.consume_keyword(Keyword::Distinct) {
                distinct = true;
                continue;
            }

            if self.consume_keyword(Keyword::Top) {
                let value = self.expect_number()?;
                if value < 0 {
                    return Err(self.error_at_current("TOP must be a positive integer"));
                }
                top = Some(value as u32);
                continue;
            }

            break;
        }

        let columns = self.parse_columns()?;

        self.expect_keyword(Keyword::From)?;
        let entity = self.parse_identifier()?;

        let filter = if self.consume_keyword(Keyword::Where) {
            Some(self.parse_expr()?)
        } else {
            None
        };

        let order_by = if self.consume_keyword(Keyword::Order) {
            self.expect_keyword(Keyword::By)?;
            self.parse_order_by()?
        } else {
            Vec::new()
        };

        if self.consume_kind(TokenKind::Semicolon) {
            // Optional trailing semicolon.
        }

        self.expect_end()?;

        Ok(SelectStmt {
            columns,
            entity,
            top,
            distinct,
            filter,
            order_by,
        })
    }

    fn parse_columns(&mut self) -> Result<SelectColumns, ParseError> {
        if self.consume_kind(TokenKind::Star) {
            return Ok(SelectColumns::All);
        }

        let mut columns = Vec::new();
        loop {
            let name = self.parse_identifier()?;
            let alias = if self.consume_keyword(Keyword::As) {
                Some(self.parse_identifier()?)
            } else if self.is_identifier() {
                Some(self.parse_identifier()?)
            } else {
                None
            };

            columns.push(Column { name, alias });

            if self.consume_kind(TokenKind::Comma) {
                continue;
            }

            break;
        }

        Ok(SelectColumns::Columns(columns))
    }

    fn parse_order_by(&mut self) -> Result<Vec<OrderBy>, ParseError> {
        let mut order_by = Vec::new();
        loop {
            let column = self.parse_identifier()?;
            let descending = if self.consume_keyword(Keyword::Desc) {
                true
            } else {
                self.consume_keyword(Keyword::Asc);
                false
            };

            order_by.push(OrderBy { column, descending });

            if self.consume_kind(TokenKind::Comma) {
                continue;
            }

            break;
        }

        Ok(order_by)
    }

    fn parse_expr(&mut self) -> Result<Expr, ParseError> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<Expr, ParseError> {
        let mut expr = self.parse_and()?;
        while self.consume_keyword(Keyword::Or) {
            let right = self.parse_and()?;
            expr = Expr::Or(Box::new(expr), Box::new(right));
        }
        Ok(expr)
    }

    fn parse_and(&mut self) -> Result<Expr, ParseError> {
        let mut expr = self.parse_primary()?;
        while self.consume_keyword(Keyword::And) {
            let right = self.parse_primary()?;
            expr = Expr::And(Box::new(expr), Box::new(right));
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<Expr, ParseError> {
        if self.consume_kind(TokenKind::LParen) {
            let expr = self.parse_expr()?;
            self.expect_kind(TokenKind::RParen)?;
            return Ok(expr);
        }

        Ok(Expr::Predicate(self.parse_predicate()?))
    }

    fn parse_predicate(&mut self) -> Result<Predicate, ParseError> {
        let column = self.parse_identifier()?;

        if self.consume_keyword(Keyword::Is) {
            let negated = self.consume_keyword(Keyword::Not);
            self.expect_keyword(Keyword::Null)?;
            return Ok(Predicate::IsNull { column, negated });
        }

        if self.consume_keyword(Keyword::Not) {
            if self.consume_keyword(Keyword::In) {
                let values = self.parse_literal_list()?;
                return Ok(Predicate::In {
                    column,
                    values,
                    negated: true,
                });
            }

            if self.consume_keyword(Keyword::Like) {
                let pattern = self.expect_string()?;
                return Ok(Predicate::Like {
                    column,
                    pattern,
                    negated: true,
                });
            }

            if self.consume_keyword(Keyword::Between) {
                let (low, high) = self.parse_between_bounds()?;
                return Ok(Predicate::Between {
                    column,
                    low,
                    high,
                    negated: true,
                });
            }

            return Err(self.error_at_current(
                "Expected IN, LIKE, or BETWEEN after NOT",
            ));
        }

        if self.consume_keyword(Keyword::In) {
            let values = self.parse_literal_list()?;
            return Ok(Predicate::In {
                column,
                values,
                negated: false,
            });
        }

        if self.consume_keyword(Keyword::Like) {
            let pattern = self.expect_string()?;
            return Ok(Predicate::Like {
                column,
                pattern,
                negated: false,
            });
        }

        if self.consume_keyword(Keyword::Between) {
            let (low, high) = self.parse_between_bounds()?;
            return Ok(Predicate::Between {
                column,
                low,
                high,
                negated: false,
            });
        }

        let op = match self.current().kind {
            TokenKind::Eq => {
                self.advance();
                CompareOp::Eq
            }
            TokenKind::Neq => {
                self.advance();
                CompareOp::Ne
            }
            TokenKind::Lt => {
                self.advance();
                CompareOp::Lt
            }
            TokenKind::Lte => {
                self.advance();
                CompareOp::Lte
            }
            TokenKind::Gt => {
                self.advance();
                CompareOp::Gt
            }
            TokenKind::Gte => {
                self.advance();
                CompareOp::Gte
            }
            _ => {
                return Err(self.error_at_current(
                    "Expected a comparison operator in predicate",
                ))
            }
        };

        let value = self.parse_literal()?;
        Ok(Predicate::Compare { column, op, value })
    }

    fn parse_between_bounds(&mut self) -> Result<(Literal, Literal), ParseError> {
        let low = self.parse_literal()?;
        self.expect_keyword(Keyword::And)?;
        let high = self.parse_literal()?;
        Ok((low, high))
    }

    fn parse_literal_list(&mut self) -> Result<Vec<Literal>, ParseError> {
        self.expect_kind(TokenKind::LParen)?;
        let mut values = Vec::new();

        loop {
            values.push(self.parse_literal()?);
            if self.consume_kind(TokenKind::Comma) {
                continue;
            }
            break;
        }

        self.expect_kind(TokenKind::RParen)?;
        Ok(values)
    }

    fn parse_literal(&mut self) -> Result<Literal, ParseError> {
        match &self.current().kind {
            TokenKind::StringLiteral(value) => {
                let value = value.clone();
                self.advance();
                Ok(Literal::String(value))
            }
            TokenKind::Number(value) => {
                let value = *value;
                self.advance();
                Ok(Literal::Number(value))
            }
            TokenKind::Keyword(Keyword::Null) => {
                self.advance();
                Ok(Literal::Null)
            }
            TokenKind::Keyword(Keyword::True) => {
                self.advance();
                Ok(Literal::Boolean(true))
            }
            TokenKind::Keyword(Keyword::False) => {
                self.advance();
                Ok(Literal::Boolean(false))
            }
            _ => Err(self.error_at_current("Expected a literal value")),
        }
    }

    fn parse_identifier(&mut self) -> Result<String, ParseError> {
        match &self.current().kind {
            TokenKind::Identifier(value) => {
                let value = value.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(self.error_at_current("Expected identifier")),
        }
    }

    fn expect_number(&mut self) -> Result<i64, ParseError> {
        match &self.current().kind {
            TokenKind::Number(value) => {
                let value = *value;
                self.advance();
                Ok(value)
            }
            _ => Err(self.error_at_current("Expected number")),
        }
    }

    fn expect_string(&mut self) -> Result<String, ParseError> {
        match &self.current().kind {
            TokenKind::StringLiteral(value) => {
                let value = value.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(self.error_at_current("Expected string literal")),
        }
    }

    fn expect_keyword(&mut self, keyword: Keyword) -> Result<(), ParseError> {
        if self.consume_keyword(keyword.clone()) {
            Ok(())
        } else {
            Err(self.error_at_current(&format!(
                "Expected keyword {:?}",
                keyword
            )))
        }
    }

    fn consume_keyword(&mut self, keyword: Keyword) -> bool {
        match &self.current().kind {
            TokenKind::Keyword(current) if current == &keyword => {
                self.advance();
                true
            }
            _ => false,
        }
    }

    fn expect_kind(&mut self, kind: TokenKind) -> Result<(), ParseError> {
        if self.consume_kind(kind.clone()) {
            Ok(())
        } else {
            Err(self.error_at_current(&format!("Expected token {:?}", kind)))
        }
    }

    fn consume_kind(&mut self, kind: TokenKind) -> bool {
        if self.current().kind == kind {
            self.advance();
            true
        } else {
            false
        }
    }

    fn is_identifier(&self) -> bool {
        matches!(self.current().kind, TokenKind::Identifier(_))
    }

    fn expect_end(&mut self) -> Result<(), ParseError> {
        match self.current().kind {
            TokenKind::Eof => Ok(()),
            _ => Err(self.error_at_current("Unexpected token after statement")),
        }
    }

    fn current(&self) -> &Token {
        &self.tokens[self.index]
    }

    fn advance(&mut self) {
        if self.index < self.tokens.len() - 1 {
            self.index += 1;
        }
    }

    fn error_at_current(&self, message: &str) -> ParseError {
        ParseError::new(message, self.current().line, self.current().column)
    }
}
