#!/usr/bin/env bash
# ==============================================================================
# Vedas AI — Linux Workstation Launcher
# Auto-detects virtualenv, checks Ollama, and starts the server from SERVER folder
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo " 🚀 VEDAS AI — LINUX RUNTIME LAUNCHER"
echo " Location: SERVER | Major Engine: Local Ollama"
echo " Web Interface: https://127.0.0.1:8000"
echo "============================================================"

# Auto-locate virtual environment
if [ -f "$SCRIPT_DIR/myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/myvenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../myvenv/bin/activate"
elif [ -f "$SCRIPT_DIR/../../myvenv/bin/activate" ]; then
    source "$SCRIPT_DIR/../../myvenv/bin/activate"
fi

# Auto-start Ollama daemon if not running
if command -v ollama >/dev/null 2>&1; then
    if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo "⚡ Starting background Ollama daemon..."
        ollama serve >/dev/null 2>&1 &
        sleep 2
    fi
fi

# Locate and run SERVER/run_vedas_web.py
if [ -f "$SCRIPT_DIR/../SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/../SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py"
else
    python3 -m uvicorn "vedas_server:app" --host 0.0.0.0 --port 8000
fi
