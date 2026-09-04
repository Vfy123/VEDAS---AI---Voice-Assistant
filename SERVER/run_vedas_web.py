#!/usr/bin/env python3
"""
Vedas AI — Web Application Launcher
Starts the Vedas FastAPI backend from the SERVER folder and automatically launches the web client.
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import time
import webbrowser
import threading
import multiprocessing
from pathlib import Path

def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))

if _is_frozen():
    RESOURCE_DIR = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    APP_DIR = Path(sys.executable).parent.resolve()
    SERVER_DIR = RESOURCE_DIR
else:
    SERVER_DIR = Path(__file__).parent.resolve()
    APP_DIR = SERVER_DIR.parent.resolve() if SERVER_DIR.name == "SERVER" else SERVER_DIR

# Ensure SERVER_DIR and APP_DIR are on sys.path
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(APP_DIR) not in sys.path:
    sys.path.insert(1, str(APP_DIR))

PORT = 8000
HOST = "127.0.0.1"

def get_url():
    try:
        from vedas_server import SSL_CERT, SSL_KEY, ensure_ssl_certs
        ensure_ssl_certs()
        if SSL_CERT.exists() and SSL_KEY.exists():
            return f"https://{HOST}:{PORT}"
    except Exception:
        pass
    return f"http://{HOST}:{PORT}"

def open_browser():
    time.sleep(1.2)
    url = get_url()
    print(f"\n🌐 Launching Vedas AI Web Interface at {url} ...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not open browser automatically: {e}")

def main():
    multiprocessing.freeze_support()

    url = get_url()
    print("=" * 65)
    print(" 🚀 VEDAS AI — WEB APPLICATION")
    print(" Primary Engine: Local Ollama | Cloud: Gemini 3.7 Flash")
    print(" Multimodal Intelligence • Document Studio • Neural Art")
    print(f" Web Interface: {url}")
    print("=" * 65)

    # Launch browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Run FastAPI / Uvicorn server with HTTPS SSL certificates
    try:
        import uvicorn
        os.chdir(str(APP_DIR))
        from vedas_server import app, SSL_CERT, SSL_KEY, ensure_ssl_certs
        ensure_ssl_certs()

        if SSL_CERT.exists() and SSL_KEY.exists():
            uvicorn.run(app, host=HOST, port=PORT, ssl_certfile=str(SSL_CERT), ssl_keyfile=str(SSL_KEY), reload=False)
        else:
            uvicorn.run(app, host=HOST, port=PORT, reload=False)
    except KeyboardInterrupt:
        print("\n⚡ Vedas AI Server stopped gracefully.")
    except Exception as e:
        print(f"\n❌ Error starting Vedas AI Server: {e}")

if __name__ == "__main__":
    main()
