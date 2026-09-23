@echo off
:: ==============================================================================
:: Vedas AI — Standalone Executable Compiler
:: Compiles Vedas AI into a self-contained .exe with external memory folder
:: ==============================================================================

title Vedas AI — Compiler & Packager
cd /d "%~dp0\.."

echo ============================================================
echo  VEDAS AI -- STANDALONE EXECUTABLE COMPILER
echo  Target: dist\VedasAI.exe
echo ============================================================

:: Check for virtual environment if active
if exist "myenv\Scripts\activate.bat" (
    call "myenv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
    call "venv\Scripts\activate.bat"
)

:: Verify PyInstaller
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
    echo Location: dist\VedasAI.exe
    echo.
    echo NOTE: The 'memory' folder is kept outside the executable
    echo so you can directly inspect, edit, and back up memory.json!
    echo ============================================================
    
    :: Ensure dist directory has memory, uploads, certs, and config ready
    if not exist "dist\memory" mkdir "dist\memory"
    if not exist "dist\uploads" mkdir "dist\uploads"
    if not exist "dist\certs" mkdir "dist\certs"
    if exist "config.json" (
        if not exist "dist\config.json" (
            copy "config.json" "dist\config.json" >nul
        )
    )
    if exist "memory\memory.json" (
        if not exist "dist\memory\memory.json" (
            copy "memory\memory.json" "dist\memory\memory.json" >nul
        )
    )
) else (
    echo.
    echo [ERROR] Compilation failed. Please inspect the logs above.
)

pause
