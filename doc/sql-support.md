# SQL Support

This page describes the SQL statement families and related query-authoring behavior QueryVerse currently supports.

## Supported SQL Statements

- `SELECT`
- `UPDATE`
- `DELETE`

## `SELECT`

Supported `SELECT`-oriented behavior includes:

- Dataverse-focused SQL-to-Fetch execution
- multiple SQL statements in one file
- active-statement intellisense
- attribute suggestions scoped to the current statement
- relationship-aware join suggestions
- joined-table alias completions
- FetchXML preview
- paged read execution

<SCREENSHOT / GIF HERE>

## `UPDATE`

Supported `UPDATE` behavior includes:

- SQL parsing into a previewable write plan
- affected-row preview before execution
- explicit confirmation before mutation
- Dataverse request-parameter visibility in the confirmation dialog

<SCREENSHOT / GIF HERE>

## `DELETE`

Supported `DELETE` behavior includes:

- SQL parsing into a previewable delete plan
- affected-row preview before execution
- explicit confirmation before mutation
- Dataverse request-parameter visibility in the confirmation dialog

<SCREENSHOT / GIF HERE>

## Important Boundaries

- QueryVerse is not trying to be a general-purpose SQL database client.
- Support is intentionally centered on the Dataverse SQL-to-Fetch feature set.
- FetchXML preview tabs are preview surfaces, not runnable connected tabs.
- Some lookup companion-column flows are more reliable when the base lookup column is also present in the `SELECT` list.

See [limitations.md](limitations.md) for the broader unsupported/known-limitation list.
