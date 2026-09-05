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

# Auto-detect Python 3 / venv
for env_name in "venv" ".venv" "myenv" "myvenv"; do
    for prefix in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.."; do
        if [ -f "$prefix/$env_name/bin/activate" ]; then
            source "$prefix/$env_name/bin/activate"
            break 2
        fi
    done
done

# Check if pre-compiled standalone binary exists
if ! command -v python3 >/dev/null 2>&1; then
    for bin_loc in "$SCRIPT_DIR/../dist/VedasAI" "$SCRIPT_DIR/../VedasAI" "$SCRIPT_DIR/VedasAI"; do
        if [ -f "$bin_loc" ]; then
            chmod +x "$bin_loc"
            exec "$bin_loc"
        fi
    done
fi

# Run Vedas AI Web
if [ -f "$SCRIPT_DIR/../SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/../SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/SERVER/run_vedas_web.py"
elif [ -f "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py" ]; then
    python3 "$SCRIPT_DIR/Vedas AI Web Group/SERVER/run_vedas_web.py"
fi
