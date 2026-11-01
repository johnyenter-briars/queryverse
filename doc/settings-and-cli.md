# Settings and CLI

QueryVerse includes both end-user settings and developer-oriented startup parameters.

<SCREENSHOT / GIF HERE>

## App Settings

Supported settings include:

- editor font size
- Vim mode for SQL tabs
- app keyboard shortcut enable/disable
- single quotes in FetchXML preview output
- Dataverse request parameters for update/delete operations

## CLI Parameters

When running the Tauri app in development, the current supported CLI parameters are:

- `--sql-file <path>`: open a SQL file on startup
- `--connection <name>`: open a startup connection
- `--log-level <error|warn|information|debug|trace>`: set backend log level
- `--open-webview-console`: open webview devtools without stealing focus

Example:

```powershell
npm run tauri dev -- -- -- -- `
  --sql-file C:\Users\Owner\dev\queryverse-test\query.sql `
  --connection jyb `
  --log-level debug `
  --open-webview-console
```

## Multiple Dev Instances

Use `scripts/dev_instance.ps1` to launch additional app instances while reusing the same Vite dev server.

Example:

```powershell
.\scripts\dev_instance.ps1 `
  -SqlFile C:\Users\Owner\dev\queryverse-test\query.sql `
  -Connection jyb `
  -LogLevel debug `
  -OpenWebviewConsole
```

## Why This Matters

The app needs to work for both normal daily use and rapid local iteration. The settings and CLI surfaces cover both.

<SCREENSHOT / GIF HERE>
