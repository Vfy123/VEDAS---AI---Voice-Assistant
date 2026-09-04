#!/usr/bin/env bash
# ==============================================================================
# Vedas AI — macOS Workstation Launcher (.command)
# Double-clickable macOS script that starts the Vedas AI server and opens browser
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo " 🚀 VEDAS AI — macOS RUNTIME LAUNCHER"
echo " Location: SERVER | Major Engine: Local Ollama"
echo " Web Interface: https://127.0.0.1:8000"
echo "============================================================"

# Auto-detect Python 3 / venv (checks myenv and myvenv)
if [ -f "$SCRIPT_DIR/myenv/bin/activate" ]; then
    source "$SCRIPT_DIR/myenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../myenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../myenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../../myenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../../myenv/bin/activate"
elif [ -f "$SCRIPT_DIR/myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/myvenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../myvenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../../myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../../myvenv/bin/activate"
fi

# Run Vedas AI Web
if [ -f "$SCRIPT_DIR/../SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/../SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py"
fi
