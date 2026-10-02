#!/usr/bin/env python3
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
import shutil
import subprocess
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

# paths
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(APP_DIR) not in sys.path:
    sys.path.insert(1, str(APP_DIR))

PORT = 8000
HOST = "127.0.0.1"


# server helpers
def get_url():
    return f"http://{HOST}:{PORT}"


# browser detection
def find_chrome_or_edge():
    if sys.platform == "win32":
        chrome_candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"),
        ]
        for p in chrome_candidates:
            if os.path.isfile(p):
                return ("Google Chrome", p)
        
        for name in ("chrome.exe", "chrome"):
            found = shutil.which(name)
            if found:
                return ("Google Chrome", found)

        edge_candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        ]
        for p in edge_candidates:
            if os.path.isfile(p):
                return ("Microsoft Edge", p)

    elif sys.platform == "darwin":
        mac_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if os.path.isfile(mac_chrome):
            return ("Google Chrome", mac_chrome)
        mac_edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        if os.path.isfile(mac_edge):
            return ("Microsoft Edge", mac_edge)

    elif sys.platform.startswith("linux"):
        for name in ("google-chrome", "google-chrome-stable", "chromium-browser", "chromium"):
            found = shutil.which(name)
            if found:
                return ("Chromium Engine", found)

    return (None, None)


# desktop client launcher
def launch_client():
    time.sleep(1.2)
    url = get_url()
    
    try:
        import run_vedas_desktop
        run_vedas_desktop.launch_app_window(url)
        return
    except Exception:
        pass

    engine_name, exe_path = find_chrome_or_edge()
    if exe_path:
        profile_dir = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "VedasAI" / "AppRuntime"
        profile_dir.mkdir(parents=True, exist_ok=True)
        for lock_name in ["lockfile", "SingletonLock", "SingletonSocket", "SingletonCookie"]:
            lock_p = profile_dir / lock_name
            if lock_p.exists():
                try: lock_p.unlink()
                except Exception: pass
        
        print("\n✨ Initializing VEDAS AI Standalone Desktop Neural Environment...")
        flags = [
            exe_path,
            f"--app={url}",
            "--window-size=1440,900",
            "--window-position=center",
            f"--user-data-dir={str(profile_dir)}",
            "--app-id=vedas-ai-neural-core",
            "--test-type",
            "--disable-infobars",
            "--force-dark-mode",
            "--enable-features=WebUIDarkMode",
            "--disable-features=Translate,OptimizationHints,MediaRouter",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-default-apps",
            "--disable-extensions",
        ]
        try:
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" and hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP") else 0
            subprocess.Popen(flags, creationflags=creationflags)
            return
        except Exception as e:
            print(f"⚠️ App launch notice: {e}")

    print(f"\n🌐 Opening Vedas AI at {url} ...")
    import webbrowser
    webbrowser.open(url)


# main entrypoint
def main():
    multiprocessing.freeze_support()

    url = get_url()
    print("=" * 65)
    print(" 🚀 VEDAS AI — DESKTOP APPLICATION RUNTIME")
    print(" Mode: Standalone Window (Zero Browser UI)")
    print(" Primary Engine: Local Ollama | Cloud: Gemini 3.7 Flash")
    print(f" Web Interface: {url}")
    print("=" * 65)

    threading.Thread(target=launch_client, daemon=True).start()

    try:
        import uvicorn
        os.chdir(str(APP_DIR))
        from vedas_server import app
        uvicorn.run(app, host=HOST, port=PORT, reload=False)
    except KeyboardInterrupt:
        print("\n⚡ Vedas AI Server stopped gracefully.")
    except Exception as e:
        print(f"\n❌ Error starting Vedas AI Server: {e}")

if __name__ == "__main__":
    main()

# khatam
