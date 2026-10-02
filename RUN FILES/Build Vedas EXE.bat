@echo off
title Vedas AI — Compiler & Packager
cd /d "%~dp0\.."

echo ============================================================
echo  VEDAS AI -- STANDALONE EXECUTABLE COMPILER
echo  Target: dist\VedasAI.exe
echo ============================================================

:: virtualenv check
if exist "myenv\Scripts\activate.bat" (
    call "myenv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
    call "venv\Scripts\activate.bat"
)

:: pyinstaller check
python -m PyInstaller --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] PyInstaller not found. Installing pyinstaller...
    python -m pip install pyinstaller
)

echo.
echo [*] Compiling VedasAI.exe using VedasAI.spec ...
python -m PyInstaller --noconfirm --clean VedasAI.spec

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo [SUCCESS] VedasAI.exe compiled successfully!
    echo Target Executable: dist\VedasAI.exe (100% Standalone Single File)
    echo All Memory, User Vaults, Sessions & UI are EMBEDDED inside the .exe!
    echo ============================================================
) else (
    echo.
    echo [ERROR] Compilation failed. Please inspect the logs above.
)

pause

:: khatam
