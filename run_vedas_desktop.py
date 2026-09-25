#!/usr/bin/env python3
"""
==============================================================================
VEDAS AI — Standalone Desktop Application Runtime
==============================================================================
Launches VEDAS AI as a sleek, standalone desktop application window powered
by Google Chrome / Chromium Application Runtime (--app mode).

- Zero browser UI: No address bar, no tabs, no bookmark bar, no extensions
- Dedicated isolated app profile: No interference with existing browser sessions
- Automatic server lifecycle: Boots FastAPI & Ollama in background and manages exit
- Seamless multi-platform fallback: Google Chrome -> MS Edge -> Brave -> Default
==============================================================================
"""

import os
import sys
import time
import shutil
import socket
import subprocess
import threading
import multiprocessing
from pathlib import Path
from typing import Optional, Tuple, List

class _SafeStreamWriter:
    def write(self, s): pass
    def flush(self): pass
    def isatty(self): return False

if sys.stdout is None:
    sys.stdout = _SafeStreamWriter()
elif hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if sys.stderr is None:
    sys.stderr = _SafeStreamWriter()
elif hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))

ROOT_DIR = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) if _is_frozen() else Path(__file__).parent.resolve()
APP_DIR = Path(sys.executable).parent.resolve() if _is_frozen() else ROOT_DIR
SERVER_DIR = (ROOT_DIR / "SERVER") if (ROOT_DIR / "SERVER").exists() else ROOT_DIR

# Ensure sys.path includes SERVER and ROOT
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(1, str(ROOT_DIR))

HOST = "127.0.0.1"
PORT = 8000
APP_NAME = "VEDAS AI 3.7 Pro"
APP_WINDOW_TITLE = "VEDAS AI 3.7 Pro — Neural Core"


def get_server_url() -> str:
    """Returns local server HTTP URL."""
    return f"http://{HOST}:{PORT}"


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if the given host/port is already accepting connections."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def wait_for_server(url: str, timeout: float = 12.0) -> bool:
    """Poll the server until it is responsive or timeout is reached."""
    import urllib.request
    import ssl
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(f"{url}/api/health", headers={"User-Agent": "VedasDesktopProbe/1.0"})
            with urllib.request.urlopen(req, timeout=1.0, context=ctx) as response:
                if response.status == 200:
                    return True
        except Exception:
            # Also test root URL
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "VedasDesktopProbe/1.0"})
                with urllib.request.urlopen(req, timeout=1.0, context=ctx) as response:
                    if response.status in (200, 301, 302, 307):
                        return True
            except Exception:
                pass
        time.sleep(0.25)
    return False


def find_chrome_executable() -> Optional[str]:
    """
    Locates Google Chrome executable on Windows, macOS, or Linux.
    Prioritizes Google Chrome as requested.
    """
    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"),
        ]
        for p in candidates:
            if os.path.isfile(p):
                return p
        
        # Check PATH
        for name in ("chrome.exe", "chrome"):
            found = shutil.which(name)
            if found and os.path.isfile(found):
                return found

        # Check Windows Registry
        try:
            import winreg
            for root_key in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                try:
                    with winreg.OpenKey(root_key, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe") as key:
                        val, _ = winreg.QueryValueEx(key, "")
                        if val and os.path.isfile(val):
                            return val
                except OSError:
                    pass
        except Exception:
            pass

    elif sys.platform == "darwin":
        mac_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if os.path.isfile(mac_chrome):
            return mac_chrome

    elif sys.platform.startswith("linux"):
        for name in ("google-chrome", "google-chrome-stable", "chromium-browser", "chromium"):
            found = shutil.which(name)
            if found:
                return found

    return None


def find_fallback_app_browsers() -> List[Tuple[str, str]]:
    """
    Returns a list of (BrowserName, ExecutablePath) for Chromium-based browsers
    that fully support standalone --app mode.
    """
    fallbacks = []
    
    if sys.platform == "win32":
        # Microsoft Edge (Built into Windows 10/11 with identical Chromium app-mode)
        edge_candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        ]
        for p in edge_candidates:
            if os.path.isfile(p):
                fallbacks.append(("Microsoft Edge", p))
                break
        
        # Brave Browser
        brave_candidates = [
            os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        ]
        for p in brave_candidates:
            if os.path.isfile(p):
                fallbacks.append(("Brave", p))
                break

    elif sys.platform == "darwin":
        edge_mac = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        brave_mac = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        if os.path.isfile(edge_mac):
            fallbacks.append(("Microsoft Edge", edge_mac))
        if os.path.isfile(brave_mac):
            fallbacks.append(("Brave", brave_mac))

    return fallbacks


def get_app_profile_dir() -> Path:
    """
    Creates an isolated user-data-dir profile directory for the VEDAS AI App Window.
    This guarantees:
    1. It opens as an independent window with its own taskbar instance.
    2. Does not conflict with existing open browser tabs.
    3. Retains persistent localStorage, session memory, and microphone permissions.
    """
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "VedasAI" / "AppRuntime"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "VedasAI" / "AppRuntime"
    else:
        base = Path.home() / ".config" / "VedasAI" / "AppRuntime"
    
    base.mkdir(parents=True, exist_ok=True)
    return base


def cleanup_stale_profile_lock(profile_dir: Path):
    """Safely cleans up stale lock files from previous sessions to prevent instant-close."""
    for lock_name in ["lockfile", "SingletonLock", "SingletonSocket", "SingletonCookie"]:
        lock_p = profile_dir / lock_name
        if lock_p.exists():
            try:
                lock_p.unlink()
            except Exception:
                pass


def launch_app_window(url: str, width: int = 1440, height: int = 900) -> Optional[subprocess.Popen]:
    """
    Launches VEDAS AI in 100% borderless Standalone App Mode.
    Zero URL bar, zero browser tabs, zero browser menus.
    """
    chrome_exe = find_chrome_executable()
    selected_exe = chrome_exe

    if not selected_exe:
        fallbacks = find_fallback_app_browsers()
        if fallbacks:
            _, selected_exe = fallbacks[0]

    profile_dir = get_app_profile_dir()
    cleanup_stale_profile_lock(profile_dir)

    if selected_exe:
        print("✨ Launching VEDAS AI Standalone Desktop Neural Environment...")
        
        flags = [
            selected_exe,
            f"--app={url}",
            f"--window-size={width},{height}",
            f"--window-position=center",
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
            "--disable-component-update",
            "--enable-gpu-rasterization",
            "--enable-zero-copy",
            "--disk-cache-size=0",
            "--media-cache-size=0",
        ]

        try:
            # On Windows, use creation flags to avoid console popup
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP") else 0
            
            proc = subprocess.Popen(flags, creationflags=creationflags)
            return proc
        except Exception as e:
            print(f"⚠️ Error starting desktop window: {e}")

    # Fallback to standard web browser if no standalone app engine is found
    print("🌐 Launching VEDAS AI Neural Interface...")
    import webbrowser
    webbrowser.open(url)
    return None


def run_server():
    """Runs the FastAPI / Uvicorn server."""
    try:
        import uvicorn
        os.chdir(str(APP_DIR))
        from vedas_server import app
        uvicorn.run(app, host=HOST, port=PORT, reload=False, log_level="warning")
    except Exception as e:
        print(f"\n❌ Server Error: {e}")


def main():
    multiprocessing.freeze_support()

    print("=" * 65)
    print(" ⚡ VEDAS AI — AUTONOMOUS DESKTOP WORKSTATION")
    print(" Mode: Standalone Neural Interface")
    print(" Intelligence: Local Ollama + Gemini 3.7 Flash Cloud Engine")
    print(f" Target Endpoint: {get_server_url()}")
    print("=" * 65)

    server_already_running = is_port_in_use(PORT, HOST)
    server_thread = None

    if not server_already_running:
        print("⚡ Initializing VEDAS AI Neural Backend Server...")
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        
        # Wait until server is live
        url = get_server_url()
        print("⏳ Synchronizing neural core...")
        if not wait_for_server(url, timeout=10.0):
            time.sleep(1.0)
    else:
        print(f"⚡ Connected to existing active VEDAS AI server on port {PORT}.")

    url = get_server_url()
    
    # Launch the standalone Desktop App Window
    app_proc = launch_app_window(url)

    # If launched as an attached process, monitor window lifecycle
    if app_proc:
        try:
            print("🚀 VEDAS AI 3.7 Pro Desktop App Window is active.")
            app_proc.wait()
            print("\n⚡ VEDAS AI Desktop Window closed. Terminating terminal cleanly...")
            time.sleep(0.1)
            os._exit(0)
        except KeyboardInterrupt:
            print("\n⚡ Interrupted by user. Shutting down...")
            try:
                app_proc.terminate()
            except Exception:
                pass
            os._exit(0)
    elif server_thread:
        try:
            while server_thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\n⚡ Exiting VEDAS AI.")
            os._exit(0)


if __name__ == "__main__":
    main()

