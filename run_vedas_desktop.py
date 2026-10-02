#!/usr/bin/env python3
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

# stream handler
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

# paths
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(1, str(ROOT_DIR))

HOST = "127.0.0.1"
PORT = 8000
APP_NAME = "VEDAS AI 4.0 Pro"
APP_WINDOW_TITLE = "VEDAS AI 4.0 Pro — Neural Core"


# server helpers
def get_server_url() -> str:
    return f"http://{HOST}:{PORT}"


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def free_port(port: int = 8000, host: str = "127.0.0.1"):
    if not is_port_in_use(port, host):
        return
    print(f"⚡ Refreshing server instance on port {port}...")
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode(errors="ignore")
            for line in out.strip().splitlines():
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in line.upper():
                    pid = parts[-1]
                    if pid != str(os.getpid()):
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
        except Exception:
            pass
    elif sys.platform in ("linux", "darwin"):
        try:
            subprocess.run(f"fuser -k {port}/tcp", shell=True, capture_output=True)
        except Exception:
            pass
    time.sleep(0.5)


def wait_for_server(url: str, timeout: float = 12.0) -> bool:
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
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "VedasDesktopProbe/1.0"})
                with urllib.request.urlopen(req, timeout=1.0, context=ctx) as response:
                    if response.status in (200, 301, 302, 307):
                        return True
            except Exception:
                pass
        time.sleep(0.25)
    return False


# browser detection
def find_chrome_executable() -> Optional[str]:
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
        
        for name in ("chrome.exe", "chrome"):
            found = shutil.which(name)
            if found and os.path.isfile(found):
                return found

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
    fallbacks = []
    
    if sys.platform == "win32":
        edge_candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        ]
        for p in edge_candidates:
            if os.path.isfile(p):
                fallbacks.append(("Microsoft Edge", p))
                break
        
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


# app profile management
def get_app_profile_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "VedasAI" / "AppRuntime"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "VedasAI" / "AppRuntime"
    else:
        base = Path.home() / ".config" / "VedasAI" / "AppRuntime"
    
    base.mkdir(parents=True, exist_ok=True)
    return base


def cleanup_stale_profile_and_cache(profile_dir: Path):
    for lock_name in ["lockfile", "SingletonLock", "SingletonSocket", "SingletonCookie"]:
        lock_p = profile_dir / lock_name
        if lock_p.exists():
            try:
                lock_p.unlink()
            except Exception:
                pass

    for cache_folder in [
        profile_dir / "Default" / "Cache",
        profile_dir / "Default" / "Code Cache",
        profile_dir / "Default" / "GPUCache",
        profile_dir / "Default" / "Service Worker",
        profile_dir / "ShaderCache",
        profile_dir / "GrShaderCache",
    ]:
        if cache_folder.exists():
            try:
                shutil.rmtree(cache_folder, ignore_errors=True)
            except Exception:
                pass


# desktop window launcher
def launch_app_window(url: str, width: int = 1440, height: int = 900) -> Optional[subprocess.Popen]:
    chrome_exe = find_chrome_executable()
    selected_exe = chrome_exe

    if not selected_exe:
        fallbacks = find_fallback_app_browsers()
        if fallbacks:
            _, selected_exe = fallbacks[0]

    profile_dir = get_app_profile_dir()
    cleanup_stale_profile_and_cache(profile_dir)

    if selected_exe:
        print("✨ Launching VEDAS AI Standalone Desktop Neural Environment...")
        
        flags = [
            selected_exe,
            f"--app={url}",
            f"--window-size={width},{height}",
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
            "--disable-component-update",
            "--enable-gpu-rasterization",
            "--enable-zero-copy",
            "--disk-cache-size=0",
            "--media-cache-size=0",
            "--disable-application-cache",
            "--v8-cache-options=none",
        ]

        try:
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP") else 0
            
            proc = subprocess.Popen(flags, creationflags=creationflags)
            return proc
        except Exception as e:
            print(f"⚠️ Error starting desktop window: {e}")

    print("🌐 Launching VEDAS AI Neural Interface in default browser...")
    import webbrowser
    webbrowser.open(url)
    return None


# server runner
def run_server():
    try:
        import uvicorn
        os.chdir(str(APP_DIR))
        from vedas_server import app
        uvicorn.run(app, host=HOST, port=PORT, reload=False, log_level="warning")
    except Exception as e:
        print(f"\n❌ Server Error: {e}")


# main entrypoint
def main():
    multiprocessing.freeze_support()

    print("=" * 65)
    print(" ⚡ VEDAS AI — AUTONOMOUS DESKTOP WORKSTATION")
    print(" Mode: Standalone Neural Interface")
    print(" Intelligence: Local Ollama + Gemini 3.7 Flash Cloud Engine")
    print(f" Target Endpoint: {get_server_url()}")
    print("=" * 65)

    free_port(PORT, HOST)

    print("⚡ Initializing VEDAS AI Neural Backend Server...")
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    url = get_server_url()
    print("⏳ Synchronizing neural core...")
    if not wait_for_server(url, timeout=10.0):
        time.sleep(1.0)

    url = get_server_url()
    app_proc = launch_app_window(url)

    print("\n🚀 VEDAS AI 4.0 Pro Desktop App is live & operational!")
    print("🌐 Web Console: " + url)
    print("⚡ Close the desktop window or press Ctrl+C to shut down.\n")

    port_fail_count = 0
    try:
        while True:
            time.sleep(1.0)

            if app_proc is not None:
                if app_proc.poll() is not None:
                    time.sleep(0.5)
                    print("\n⚡ VEDAS AI Desktop window closed. Shutting down system cleanly...")
                    break

            if not server_thread.is_alive():
                print("\n⚡ VEDAS AI Server thread terminated. Exiting desktop runtime...")
                break

            if not is_port_in_use(PORT, HOST):
                port_fail_count += 1
                if port_fail_count >= 15 and not server_thread.is_alive():
                    print("\n⚡ VEDAS AI Server unreachable. Exiting desktop runtime...")
                    break
            else:
                port_fail_count = 0

    except KeyboardInterrupt:
        print("\n⚡ User requested shutdown. Terminating VEDAS AI cleanly...")
    finally:
        if app_proc and app_proc.poll() is None:
            try:
                app_proc.terminate()
            except Exception:
                pass
        print("⚡ System shutdown complete.")
        sys.exit(0)


if __name__ == "__main__":
    main()

# khatam
