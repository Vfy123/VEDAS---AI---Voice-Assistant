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
for env_name in "venv" ".venv" "myenv" "myvenv"; do
    for prefix in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.."; do
        if [ -f "$prefix/$env_name/bin/activate" ]; then
            source "$prefix/$env_name/bin/activate"
            break 2
        fi
    done
done

# Check if pre-compiled standalone binary exists and run it if python is missing
if ! command -v python3 >/dev/null 2>&1; then
    for bin_loc in "$SCRIPT_DIR/../dist/VedasAI" "$SCRIPT_DIR/../VedasAI" "$SCRIPT_DIR/VedasAI"; do
        if [ -f "$bin_loc" ]; then
            chmod +x "$bin_loc"
            exec "$bin_loc"
        fi
    done
fi

# Auto-start Ollama daemon if not running
if command -v ollama >/dev/null 2>&1; then
    if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
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
