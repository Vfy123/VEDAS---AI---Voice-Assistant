@echo off
:: ==============================================================================
:: Vedas AI — Windows Workstation Launcher
:: Auto-detects Python / venv, verifies Ollama, starts HTTPS server & opens browser
:: ==============================================================================

title Vedas AI — Command Center
cd /d "%~dp0"

echo ============================================================
echo  [36m VEDAS AI -- WINDOWS RUNTIME LAUNCHER [0m
echo  Location: SERVER ^| Major Engine: Local Ollama
echo  Web Interface: https://127.0.0.1:8000
echo ============================================================

:: Check for virtual environment (checks myenv and myvenv)
if exist "myenv\Scripts\activate.bat" (
    call "myenv\Scripts\activate.bat"
) else if exist "..\myenv\Scripts\activate.bat" (
    call "..\myenv\Scripts\activate.bat"
) else if exist "..\..\myenv\Scripts\activate.bat" (
    call "..\..\myenv\Scripts\activate.bat"
) else if exist "myvenv\Scripts\activate.bat" (
    call "myvenv\Scripts\activate.bat"
) else if exist "..\myvenv\Scripts\activate.bat" (
    call "..\myvenv\Scripts\activate.bat"
) else if exist "..\..\myvenv\Scripts\activate.bat" (
    call "..\..\myvenv\Scripts\activate.bat"
)

:: Check if Ollama is running (use 127.0.0.1 to avoid Windows IPv6 localhost delay)
where ollama >nul 2>nul
if %errorlevel% equ 0 (
    curl -s http://127.0.0.1:11434/api/tags >nul 2>nul
    if %errorlevel% neq 0 (
        echo Starting Ollama background service...
        start "" /B ollama serve
        timeout /t 2 /nobreak >nul
    )
)

:: Run Vedas AI Web from SERVER
if exist "..\SERVER\run_vedas_web.py" (
    python "..\SERVER\run_vedas_web.py"
) else if exist "SERVER\run_vedas_web.py" (
    python "SERVER\run_vedas_web.py"
) else if exist "Vedas AI Web Group\SERVER\run_vedas_web.py" (
    python "Vedas AI Web Group\SERVER\run_vedas_web.py"
)

pause
