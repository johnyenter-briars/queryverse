<h1 align="left">QueryVerse
  <img align="left" src="./img/app-icon.png" alt="QueryVerse app icon" style="height: 1.5em;" />
</h1>


Perform SQL queries against [Microsoft Dataverse](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/data-platform-intro) — ⚡blazingly⚡fast.

## What is QueryVerse?
QueryVerse is a [Dataverse](https://www.microsoft.com/en-us/power-platform/dataverse)-focused SQL client with fast query execution and a workflow tuned for everyday data access.

## Who is it For?
- **Developers:** iterate quickly with SQL-to-Fetch, paging, and TDS-aware performance.
- **Functional consultants:** validate data models, troubleshoot integrations, and share saved SQL with clients.
- **Business users:** run safe, repeatable queries and export results without a heavy setup.

## High-Level Objectives
- Drop-in replacement for a SQL client
  - Read and update
  - SQL-to-Fetch engine
  - Paging
  - JSON-to-entity conversion
  - TDS optimization
- Convert to FetchXML
- Save SQL files
- Save multiple connections
- Tabs
  - Each tab is a different connection
- Results window
  - Copy to JSON
  - Open JSON in a new window

## Current Features
- Execute Dataverse SQL queries from a desktop client.
- Translate SQL to FetchXML.
- Preview generated FetchXML before execution.
- Run paged Dataverse reads through the Rust backend.
- Open multiple query tabs.
- Associate tabs with saved Dataverse connections.
- Create, update, and persist connection profiles.
- Open SQL files from disk.
- Save SQL files.
- Save SQL files as new files.
- Open a SQL file on startup from CLI.
- Select a startup connection from CLI.
- Set backend log level from CLI.
- Open webview devtools from CLI.
- Browse Dataverse schema metadata.
- Load entity definitions for the selected connection.
- Load entity attributes on demand.
- Execute `UPDATE` statements with preview-before-confirm flow.
- Execute `DELETE` statements with preview-before-confirm flow.
- Show affected row count before update/delete execution.
- Show current Dataverse request-parameter state in update/delete confirmation dialogs.
- Persist app settings locally.
- Configure editor font size.
- Enable or disable Vim mode for SQL tabs.
- Enable or disable app keyboard shortcuts.
- Toggle single quotes in FetchXML preview output.
- Configure Dataverse request parameters from settings.
- Support `BypassBusinessLogicExecution` request parameters.
- Support `BypassCustomPluginExecution` request parameter.
- Support `SuppressCallbackRegistrationExpanderJob` request parameter.
- Show `BypassBusinessLogicExecutionStepIds` as not implemented yet in settings.
- Apply Dataverse request parameters to update operations.
- Apply Dataverse request parameters to delete operations.
- Show query results in a virtualized grid.
- Keep a visible row number column in results.
- Show stronger grid-style row and cell separators in results.
- Double-click a result cell to copy its value to the clipboard.
- Show toast notifications for copy and other frontend actions.
- Show query execution errors inline in the results area.
- Keep per-tab query text, results, and execution state.

## Known Issues
- Companion lookup columns such as `owneridname`, `owneridtype`, or custom lookup `...name` / `...type` fields may require the base lookup column to also be present in the `SELECT` list. For example, `select ownerid, owneridname from account` is currently more reliable than `select owneridname from account`.

## Dev CLI Params
When running the Tauri dev app, the following CLI params are supported:
- `--sql-file <path>`: Open a SQL file on startup.
- `--connection <name>`: Select a connection profile on startup.
- `--log-level <error|warn|information|debug|trace>`: Set backend logging level.
- `--open-webview-console`: Open the webview devtools without stealing focus.

Example:
```powershell
npm run tauri dev -- -- -- -- `
  --sql-file C:\Users\Owner\dev\queryverse-test\query.sql `
  --connection jyb `
  --log-level debug `
  --open-webview-console
```

## Multiple Dev Instances
Use `scripts/dev_instance.ps1` to run multiple app instances while sharing the same Vite dev server.
The script will:
- Start Vite on port 1420 if it is not already running.
- Launch the Tauri backend without starting a second dev server.

Example:
```powershell
.\scripts\dev_instance.ps1 `
  -SqlFile C:\Users\Owner\dev\queryverse-test\query.sql `
  -Connection jyb `
  -LogLevel debug `
  -OpenWebviewConsole
```

## AI Disclosure
Portions of this project were developed with the assistance of AI tools; all changes are reviewed and tested by maintainers.

## Acknowledgements
QueryVerse is lovingly inspired by the [SQL4CDS](https://www.xrmtoolbox.com/plugins/MarkMpn.SQL4CDS/) project. <3
