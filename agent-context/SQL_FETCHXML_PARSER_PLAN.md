# SQL to FetchXML Parser Proposal

## Goals
- Add a pure Rust SQL parser and FetchXML translator to run Dataverse queries without external parsing crates.
- Keep the parser modular (lexer, AST, parser, translator) and easy to extend.
- Provide precise errors (line/column) to surface in the UI.

## SQL Coverage (Phase 1)
- `SELECT [TOP n] [DISTINCT] <columns> FROM <entity>`
- Column lists with `*`, optional aliases, and `AS`.
- `WHERE` with `=`, `!=`, `<`, `<=`, `>`, `>=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`, `IS NOT NULL`.
- Boolean logic with `AND`, `OR`, and parentheses.
- `ORDER BY <column> [ASC|DESC]`.

Non-goals for v1: joins, aggregates, subqueries, and `GROUP BY`. These can be added in a follow-up phase.

## Architecture and Module Layout
Add a new module under `src-tauri/src/sql_fetchxml/`:
- `mod.rs`: public API entry points.
- `lexer.rs`: tokenizes SQL into keywords, identifiers, literals, and symbols.
- `ast.rs`: AST structs (`SelectStmt`, `Expr`, `Predicate`, `OrderBy`).
- `parser.rs`: recursive-descent parser with operator precedence for boolean expressions.
- `fetchxml.rs`: converts AST to FetchXML string, including XML escaping.
- `errors.rs`: `ParseError` with span, line, and column.

Public API sketch:
- `parse(sql: &str) -> Result<SelectStmt, ParseError>`
- `to_fetchxml(stmt: &SelectStmt) -> Result<String, TranslationError>`
- `sql_to_fetchxml(sql: &str) -> Result<FetchXmlQuery, SqlError>` where `FetchXmlQuery` includes the entity name plus FetchXML.

## FetchXML Mapping Rules
- `SELECT` columns -> `<attribute name="..." />` or `<all-attributes />`.
- `FROM <entity>` -> `<entity name="<entity>" />`.
- `TOP n` -> `<fetch top="n" />`.
- `DISTINCT` -> `<fetch distinct="true" />`.
- `WHERE` -> nested `<filter type="and|or">` with `<condition>` nodes.
- `ORDER BY` -> `<order attribute="..." descending="true|false" />`.

## Backend Integration Points
- Add a Tauri command `parse_sql_to_fetchxml(sql: String)` to preview translation errors in the UI.
- Add a Tauri command `execute_sql(sql: String)` that:
  1) parses SQL -> FetchXML,
  2) calls a new `QueryEngine::retrieve_multiple_fetchxml(entity, fetchxml)` method,
  3) returns a `MultipleResponse<Entity>`.
- Update `src-tauri/src/lib.rs` to include the new command in `invoke_handler`.
- Update `src/binding/backend.ts` with an `executeSql` helper.

## Testing Plan
- `cargo test` unit tests for lexer/parser edge cases and error spans.
- Golden tests: SQL input -> expected FetchXML output.
- Integration test for `execute_sql` using a mocked token or a test Dataverse instance (if available).

## Phased Delivery
1) Parser + FetchXML translation for Phase 1 grammar.
2) Wire `execute_sql` into the app and UI run flow.
3) Extend grammar to joins and aggregates with `<link-entity>` and `<aggregate>` support.
