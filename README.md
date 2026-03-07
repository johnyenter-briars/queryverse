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
