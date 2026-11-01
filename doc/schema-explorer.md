# Schema Explorer

The schema explorer gives a connection-scoped view of Dataverse metadata without coupling that metadata state to the current query tab.

<SCREENSHOT / GIF HERE>

## Supported Workflows

- Pick a schema connection from a Fluent UI dropdown.
- Default to the CLI-selected connection when one is provided at startup.
- Start unselected when no startup connection was supplied.
- Browse entity definitions.
- Load attributes and relationships for the selected entity.
- Open schema tabs that include the selected connection in the tab title.

## Important Behavior

- The schema explorer has its own selected connection.
- Changing the schema connection does not change query tab connections.
- Schema tabs include the connection name in the title so the metadata source stays obvious.

## Why This Matters

Metadata browsing and query execution are related, but they should not overwrite each other's state. QueryVerse keeps those concerns separate on purpose.

<SCREENSHOT / GIF HERE>
