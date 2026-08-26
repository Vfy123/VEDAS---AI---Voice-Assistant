# ==============================================================================
# Vedas AI — Windows PowerShell Launcher
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 🚀 VEDAS AI — WINDOWS POWERSHELL RUNTIME" -ForegroundColor Cyan
Write-Host " Location: SERVER | Major Engine: Local Ollama" -ForegroundColor Green
Write-Host " Web Interface: https://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# Activate Virtual Environment if available
if (Test-Path "$ScriptDir\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\myvenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\myvenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\..\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\..\myvenv\Scripts\Activate.ps1"
}

# Run Launcher
if (Test-Path "$ScriptDir\..\SERVER\run_vedas_web.py") {
    python "$ScriptDir\..\SERVER\run_vedas_web.py"
} elseif (Test-Path "$ScriptDir\SERVER\run_vedas_web.py") {
    python "$ScriptDir\SERVER\run_vedas_web.py"
} elseif (Test-Path "$ScriptDir\Vedas AI Web Group\SERVER\run_vedas_web.py") {
    python "$ScriptDir\Vedas AI Web Group\SERVER\run_vedas_web.py"
}
