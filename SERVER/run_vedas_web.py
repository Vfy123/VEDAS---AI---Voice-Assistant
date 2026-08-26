#!/usr/bin/env python3
"""
Vedas AI — Web Application Launcher
Starts the Vedas FastAPI backend from the SERVER folder and automatically launches the web client.
"""

import os
import sys
import time
import webbrowser
import threading
from pathlib import Path

SERVER_DIR = Path(__file__).parent.resolve()
APP_DIR = SERVER_DIR.parent.resolve() if SERVER_DIR.name == "SERVER" else SERVER_DIR

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(APP_DIR) not in sys.path:
    sys.path.insert(1, str(APP_DIR))

PORT = 8000
HOST = "127.0.0.1"
URL = f"https://{HOST}:{PORT}"

def open_browser():
    time.sleep(1.2)
    print(f"\n🌐 Launching Vedas AI Web Interface at {URL} ...")
    try:
        webbrowser.open(URL)
    except Exception as e:
        print(f"Could not open browser automatically: {e}")

def main():
    print("=" * 65)
    print(" 🚀 VEDAS AI — WEB APPLICATION (HTTPS SECURE)")
    print(" Location: SERVER Module | Primary Engine: Local Ollama")
    print(" Multimodal Intelligence • PDF Ingestion • Neural Art Studio")
    print(f" Web Interface: {URL}")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        import uvicorn
        os.chdir(str(SERVER_DIR))
        from vedas_server import SSL_CERT, SSL_KEY, ensure_ssl_certs
        ensure_ssl_certs()

        if SSL_CERT.exists() and SSL_KEY.exists():
            uvicorn.run("vedas_server:app", host=HOST, port=PORT, ssl_certfile=str(SSL_CERT), ssl_keyfile=str(SSL_KEY), reload=False)
        else:
            uvicorn.run("vedas_server:app", host=HOST, port=PORT, reload=False)
    except KeyboardInterrupt:
        print("\n⚡ Vedas AI Server stopped gracefully.")
    except Exception as e:
        print(f"\n❌ Error starting Vedas AI Server: {e}")

if __name__ == "__main__":
    main()
