# Query Editor and Tabs

The query editor is the center of QueryVerse. It is built around SQL authoring, fast execution, and tab-local context rather than a global connection state.

<SCREENSHOT / GIF HERE>

## Core Capabilities

- Open multiple SQL tabs at once.
- Keep query text, results, and execution state per tab.
- Bind runnable tabs to a specific Dataverse connection.
- Show connection state directly in the tab label.
- Open FetchXML preview tabs that are intentionally not connection-bound.
- Open a SQL file at startup from the CLI.
- Support multiple SQL statements in a single file.
- Scope intellisense to the active statement instead of the first statement in the document.

## Tab Model

- Query tabs carry their own selected connection.
- The tab label shows a link icon, the connection name, and the file/query name.
- Selecting a connection from the left tree opens a new connected tab without changing other tabs.
- FetchXML preview tabs do not carry connections.

## Intellisense Notes

- Attribute suggestions are based on the active SQL statement around the cursor.
- Join suggestions use the current statement context rather than the first query in the file.
- Joined table aliases are recognized for completions like `account.` when the join is in the active statement.

<SCREENSHOT / GIF HERE>

## Why This Matters

The editor is designed so each tab behaves like an independent workspace. That avoids the old global-connection model where changing one connection changed the meaning of another tab.
