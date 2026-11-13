# Opens a separate Chrome window (throwaway profile) with remote debugging for cdp.mjs.
# Rendering keeps running even when the window is covered (otherwise per-frame game state goes stale).
# If a debug Chrome with this profile is already open, close it first: new flags are ignored by a running instance.
# usage: powershell -File launch-chrome.ps1 [-Url http://localhost:5173/] [-Port 9333]
param([string]$Url = "http://localhost:5173/", [int]$Port = 9333)
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Chrome not found" }
$profileDir = Join-Path $env:TEMP "gwp-playtest-chrome"
Start-Process -FilePath $chrome -ArgumentList @("--remote-debugging-port=$Port", "--user-data-dir=$profileDir", "--no-first-run", "--no-default-browser-check", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--window-size=1280,860", $Url)
Start-Sleep -Seconds 3
(Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/json/version").Content
