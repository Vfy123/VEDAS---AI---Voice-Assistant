@echo off
title Vedas AI — Desktop Application
cd /d "%~dp0"

echo ============================================================
echo  [36m VEDAS AI -- DESKTOP APPLICATION RUNTIME [0m
echo  Engine: Google Chrome App Mode ^| AI Core: Ollama + Gemini
echo  Target: Standalone Window (Zero Browser Chrome)
echo ============================================================

:: virtualenv activation
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

:: ollama check
where ollama >nul 2>nul
if %errorlevel% equ 0 (
    curl -s http://127.0.0.1:11434/api/tags >nul 2>nul
    if %errorlevel% neq 0 (
        echo Starting Ollama background service...
        start "" /B ollama serve
        timeout /t 2 /nobreak >nul
    )
)

:: desktop launcher
if exist "..\run_vedas_desktop.py" (
    python "..\run_vedas_desktop.py"
) else if exist "run_vedas_desktop.py" (
    python "run_vedas_desktop.py"
) else if exist "..\SERVER\run_vedas_web.py" (
    python "..\SERVER\run_vedas_web.py"
) else if exist "SERVER\run_vedas_web.py" (
    python "SERVER\run_vedas_web.py"
)

pause

:: khatam
