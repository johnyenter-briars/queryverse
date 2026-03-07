param(
    [string]$SqlFile = "",
    [string]$Connection = "",
    [string]$LogLevel = "debug",
    [switch]$OpenWebviewConsole
)

$port = 1420
$running = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationLevel Quiet

if (-not $running) {
    Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--port",$port,"--strictPort" -WindowStyle Hidden | Out-Null
}

$appArgs = @()
if ($SqlFile) { $appArgs += "--sql-file"; $appArgs += $SqlFile }
if ($Connection) { $appArgs += "--connection"; $appArgs += $Connection }
if ($LogLevel) { $appArgs += "--log-level"; $appArgs += $LogLevel }
if ($OpenWebviewConsole) { $appArgs += "--open-webview-console" }

npm run tauri dev -- --no-dev-server --no-dev-server-wait -- -- @appArgs
