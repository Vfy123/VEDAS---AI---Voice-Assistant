# ==============================================================================
# Vedas AI — Windows PowerShell Desktop Launcher
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 🚀 VEDAS AI — DESKTOP APPLICATION RUNTIME" -ForegroundColor Cyan
Write-Host " Engine: Google Chrome App Mode | Major Engine: Local Ollama" -ForegroundColor Green
Write-Host " Mode: Standalone Window (Zero Browser UI)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# Activate Virtual Environment if available (checks myenv and myvenv)
if (Test-Path "$ScriptDir\myenv\Scripts\Activate.ps1") {
    & "$ScriptDir\myenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\myenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\myenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\..\myenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\..\myenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\myvenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\myvenv\Scripts\Activate.ps1"
} elseif (Test-Path "$ScriptDir\..\..\myvenv\Scripts\Activate.ps1") {
    & "$ScriptDir\..\..\myvenv\Scripts\Activate.ps1"
}

# Run Launcher
if (Test-Path "$ScriptDir\..\run_vedas_desktop.py") {
    python "$ScriptDir\..\run_vedas_desktop.py"
} elseif (Test-Path "$ScriptDir\run_vedas_desktop.py") {
    python "$ScriptDir\run_vedas_desktop.py"
} elseif (Test-Path "$ScriptDir\..\SERVER\run_vedas_web.py") {
    python "$ScriptDir\..\SERVER\run_vedas_web.py"
} elseif (Test-Path "$ScriptDir\SERVER\run_vedas_web.py") {
    python "$ScriptDir\SERVER\run_vedas_web.py"
}
