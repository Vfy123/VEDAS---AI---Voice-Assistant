import os
import sys

# Ensure UTF-8 output on Windows consoles to prevent charmap UnicodeEncodeErrors
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

import json
import time
import threading
import subprocess
import webbrowser
import datetime
import ctypes
import requests
import re
import math
try:
    import psutil
except ImportError:
    psutil = None
import base64
import io
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
try:
    from PIL import Image
except ImportError:
    Image = None

# PDF reader import
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# Google GenAI import
try:
    from google import genai
except ImportError:
    genai = None

# DuckDuckGo Search import
try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None

# Wikipedia import
try:
    import wikipedia
except ImportError:
    wikipedia = None

# PyJokes import
try:
    import pyjokes
except ImportError:
    pyjokes = None

# PyAutoGUI import (fallback for headless/non-X11)
try:
    import pyautogui
except Exception:
    pyautogui = None

IS_WINDOWS = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def resource_root() -> Path:
    """Read-only bundled assets (static UI, seed memory) when running as .exe."""
    if _is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    here = Path(__file__).parent.resolve()
    return here.parent.resolve() if here.name == "SERVER" else here


def data_root() -> Path:
    """Writable app data: memory.json, uploads, and certs live here permanently."""
    if _is_frozen():
        return Path(sys.executable).parent.resolve()
    here = Path(__file__).parent.resolve()
    return here.parent.resolve() if here.name == "SERVER" else here


RESOURCE_DIR = resource_root()
SERVER_DIR = Path(__file__).parent.resolve() if not _is_frozen() else RESOURCE_DIR
APP_DIR = data_root()
MEMORY_DIR = APP_DIR / "memory"
MEMORY_FILE = MEMORY_DIR / "memory.json"
UPLOAD_DIR = APP_DIR / "uploads"
_bundled_static = RESOURCE_DIR / "static"
STATIC_DIR = _bundled_static if _bundled_static.exists() else (APP_DIR / "static")
CERTS_DIR = APP_DIR / "certs"


def bootstrap_persistent_data():
    """Keep memory/uploads/certs in accessible folders next to the .exe so they survive restarts."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CERTS_DIR.mkdir(parents=True, exist_ok=True)
    if not STATIC_DIR.exists():
        STATIC_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Seed or migrate memory into the accessible 'memory/' folder
    legacy_memory = APP_DIR / "memory.json"
    seed_memory = RESOURCE_DIR / "memory.json"
    if not MEMORY_FILE.exists():
        if legacy_memory.exists() and legacy_memory.resolve() != MEMORY_FILE.resolve():
            try:
                MEMORY_FILE.write_bytes(legacy_memory.read_bytes())
            except Exception as e:
                print(f"Memory migration notice: {e}")
        elif seed_memory.exists() and seed_memory.resolve() != MEMORY_FILE.resolve():
            try:
                MEMORY_FILE.write_bytes(seed_memory.read_bytes())
            except Exception as e:
                print(f"Seed memory notice: {e}")
        else:
            MEMORY_FILE.write_text(
                json.dumps({"notes": [], "sessions": []}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    # 2. SSL certificates
    for name in ("cert.pem", "key.pem"):
        dest = CERTS_DIR / name
        src = RESOURCE_DIR / "certs" / name
        if not dest.exists() and src.exists():
            dest.write_bytes(src.read_bytes())


bootstrap_persistent_data()

def _load_local_env():
    """Load key-value pairs from .env files scoped strictly within Vedas AI Web Group."""
    for env_path in [APP_DIR / ".env", SERVER_DIR / ".env"]:
        if env_path.exists():
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

_load_local_env()

# Application Configuration & Model Defaults (Ollama is the major/primary engine)
APP_CONFIG = {
    "local_model": "llama3.2:latest",
    "cloud_model": "gemini-3.7-flash",
    "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
    "ollama_host": "http://127.0.0.1:11434",
    "speech_rate": 1.0,
    "wake_word_enabled": True,
    "supervisor_enabled": True,
    "temperature": 0.7,
    "system_persona": "master_vedas",
    "reasoning_pass": True
}

PERSONAS = {
    "master_vedas": "You are VEDAS, a brilliant, highly capable, and helpful AI assistant. Respond directly, naturally, and intelligently. Format your response cleanly using Markdown with code blocks, lists, and bold text where appropriate. Never output robotic meta-commentary, fake system protocols, or artificial templates.",
    "cyber_coder": "You are VEDAS (Cyber Coder), an expert software engineer. Provide clean, production-ready code with concise explanations.",
    "deep_thinker": "You are VEDAS (Deep Thinker), an analytical intellect specializing in complex logic, math, and multi-step reasoning.",
    "creative_muse": "You are VEDAS (Creative Muse), an imaginative visionary writer and concept designer.",
    "sarcastic_genius": "You are VEDAS (Sarcastic Genius), a witty, charming, sharp assistant."
}

_memory_lock = threading.Lock()

def load_memory() -> Dict[str, Any]:
    default_mem = {"notes": [], "sessions": []}
    if MEMORY_FILE.exists():
        try:
            data = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
            if "sessions" not in data: data["sessions"] = []
            if "notes" not in data: data["notes"] = []
            return data
        except Exception as e:
            print(f"Memory load error: {e}")
            return default_mem
    return default_mem

def save_memory(mem: Dict[str, Any]):
    with _memory_lock:
        MEMORY_FILE.write_text(json.dumps(mem, ensure_ascii=False, indent=2), encoding="utf-8")

memory = load_memory()

# Helper: Get Gemini Client
def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY") or APP_CONFIG.get("gemini_api_key", "").strip()
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        return None
    if not genai:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Gemini Client Init Error: {e}")
        return None

# Ordered Gemini model fallback chain (newest/first preference first).
# On 503 (quota/overload) or any error the next model in the list is tried.
GEMINI_MODEL_CHAIN = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
]

def build_gemini_chain(preferred_model: Optional[str] = None) -> List[str]:
    """Return a model chain prioritizing preferred_model first, followed by the fallback chain."""
    chain = list(GEMINI_MODEL_CHAIN)
    if preferred_model:
        if preferred_model not in chain:
            return [preferred_model] + chain
        return [preferred_model] + [m for m in chain if m != preferred_model]
    return chain

def gemini_generate_with_fallback(client, contents, preferred_models=None):
    """Try each Gemini model in order; fall back to the next on errors/503."""
    chain = list(preferred_models) if preferred_models else list(GEMINI_MODEL_CHAIN)
    if not chain:
        chain = [APP_CONFIG.get("cloud_model", "gemini-3.7-flash")]

    last_error = None
    for model in chain:
        try:
            config = {"automatic_function_calling": {"disable": True}}
            resp = client.models.generate_content(model=model, contents=contents, config=config)
            return model, resp
        except Exception as e:
            last_error = e
            print(f"Gemini model '{model}' failed ({type(e).__name__}: {e}); trying next...")
            continue
    raise last_error if last_error else RuntimeError("No Gemini models available.")

# Helper: Auto-start and verify Ollama background daemon
def ensure_ollama_running() -> bool:
    """Verifies Ollama daemon is responsive; if not, attempts background launch."""
    host = APP_CONFIG.get("ollama_host", "http://127.0.0.1:11434")
    # Quick probe
    for probe_url in [host, "http://127.0.0.1:11434"]:
        try:
            r = requests.get(f"{probe_url}/api/tags", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass

    # Attempt to locate ollama executable
    ollama_path = shutil.which("ollama")
    if not ollama_path and IS_WINDOWS:
        candidate = Path.home() / "AppData" / "Local" / "Programs" / "Ollama" / "ollama.exe"
        if candidate.exists():
            ollama_path = str(candidate)

    if ollama_path:
        try:
            print("⚡ Starting background Ollama daemon...")
            if IS_WINDOWS:
                CREATE_NO_WINDOW = 0x08000000
                subprocess.Popen(
                    [ollama_path, "serve"],
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                subprocess.Popen(
                    [ollama_path, "serve"],
                    start_new_session=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            # Wait up to 6 seconds for daemon to initialize
            for _ in range(12):
                time.sleep(0.5)
                for probe_url in ["http://127.0.0.1:11434", host]:
                    try:
                        r = requests.get(f"{probe_url}/api/tags", timeout=1.0)
                        if r.status_code == 200:
                            print("⚡ Ollama daemon is active and responsive.")
                            return True
                    except Exception:
                        pass
        except Exception as ex:
            print(f"Notice: Failed to auto-launch Ollama daemon: {ex}")

    return False

# Helper: Get Installed Ollama Models from Local Daemon
def get_installed_ollama_models() -> List[str]:
    # Probe 127.0.0.1 first to avoid Windows IPv6 localhost 2s latency penalty
    hosts = ["http://127.0.0.1:11434"]
    configured_host = APP_CONFIG.get("ollama_host", "http://127.0.0.1:11434")
    if configured_host not in hosts:
        hosts.append(configured_host)

    for host in hosts:
        try:
            res = requests.get(f"{host}/api/tags", timeout=1.5)
            if res.status_code == 200:
                models_info = res.json().get("models", [])
                names = [m.get("name") for m in models_info if m.get("name")]
                if names:
                    return names
        except Exception:
            continue
    return []

# Helper: Precisely resolve requested model to best installed model without false prefix matches
def resolve_ollama_model(target_model: str, installed: Optional[List[str]] = None) -> str:
    """Matches target_model to installed models strictly.
    Prevents false prefix matching such as 'llama3.2' matching 'llama3'.
    """
    if installed is None:
        installed = get_installed_ollama_models()
    if not installed:
        return target_model
    if target_model in installed:
        return target_model

    target_clean = target_model.lower()
    target_base = target_clean.split(":")[0]
    target_tag = target_clean.split(":")[1] if ":" in target_clean else ""

    # 1. Exact base match with tag
    for m in installed:
        m_clean = m.lower()
        m_base = m_clean.split(":")[0]
        m_tag = m_clean.split(":")[1] if ":" in m_clean else ""
        if m_base == target_base and m_tag == target_tag:
            return m

    # 2. Exact base match with any tag (e.g. llama3.2:1b for llama3.2:latest)
    for m in installed:
        m_clean = m.lower()
        m_base = m_clean.split(":")[0]
        if m_base == target_base:
            return m

    # 3. Model where base matches with library prefix (e.g. library/llama3.2:latest)
    for m in installed:
        m_clean = m.lower()
        m_base = m_clean.split("/")[-1].split(":")[0]
        if m_base == target_base:
            return m

    # 4. If llama3.2 specifically requested, prefer any model with llama3.2
    if "llama3.2" in target_base:
        llama32 = next((m for m in installed if "llama3.2" in m.lower()), None)
        if llama32:
            return llama32

    # 5. Otherwise, if an exact base match isn't found, keep target_model or first installed
    return installed[0]

# Helper: Get Available / Supported Ollama Models
def get_ollama_models() -> List[str]:
    installed = get_installed_ollama_models()
    known = ["llama3.2:latest", "llama3:latest", "qwen2.5:7b", "phi4:latest"]
    if installed:
        return list(dict.fromkeys(installed + known))
    return known

# FastAPI App
app = FastAPI(title="Vedas AI", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Request Models
class ChatRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    persona: Optional[str] = "master_vedas"
    model_override: Optional[str] = None
    use_web_search: Optional[bool] = False
    enable_thinking: Optional[bool] = True
    attachments: Optional[List[Dict[str, Any]]] = None

class SupervisorCheckRequest(BaseModel):
    prompt: str
    ai_answer: str

class ImageGenRequest(BaseModel):
    prompt: str
    style: Optional[str] = "cinematic"
    aspect_ratio: Optional[str] = "1:1"
    model: Optional[str] = "flux"
    enhance_prompt: Optional[bool] = True
    seed: Optional[int] = None

class CodeExecRequest(BaseModel):
    code: str

class NoteRequest(BaseModel):
    note: str

class SystemCommandRequest(BaseModel):
    command: str

class FileEditRequest(BaseModel):
    path: str
    content: str

class FileBrowseRequest(BaseModel):
    path: Optional[str] = None

class CreateItemRequest(BaseModel):
    path: str
    is_folder: bool = False

class RenameRequest(BaseModel):
    path: str
    new_name: str

class DeleteItemRequest(BaseModel):
    path: str


# ----------------- SYSTEM ACTION RUNNER -----------------
def execute_system_action(command_str: str) -> Dict[str, Any]:
    cmd = command_str.lower().strip()
    desktop_path = Path.home() / "Desktop"

    # Open Applications
    app_map = {
        "notepad": ("notepad.exe" if IS_WINDOWS else "gedit"),
        "calculator": ("calc.exe" if IS_WINDOWS else "gnome-calculator"),
        "paint": ("mspaint.exe" if IS_WINDOWS else "gimp"),
        "chrome": ("start chrome" if IS_WINDOWS else "google-chrome"),
        "browser": ("start chrome" if IS_WINDOWS else "xdg-open https://"),
        "explorer": ("explorer.exe" if IS_WINDOWS else "nautilus"),
        "file manager": ("explorer.exe" if IS_WINDOWS else "nautilus"),
        "task manager": ("taskmgr.exe" if IS_WINDOWS else "gnome-system-monitor"),
        "terminal": ("start cmd" if IS_WINDOWS else "x-terminal-emulator"),
        "cmd": ("start cmd" if IS_WINDOWS else "x-terminal-emulator"),
        "command prompt": ("start cmd" if IS_WINDOWS else "x-terminal-emulator"),
        "word": ("start winword" if IS_WINDOWS else "libreoffice --writer"),
        "excel": ("start excel" if IS_WINDOWS else "libreoffice --calc"),
        "vlc": ("start vlc" if IS_WINDOWS else "vlc"),
        "spotify": ("start spotify" if IS_WINDOWS else "spotify"),
        "discord": ("start discord" if IS_WINDOWS else "discord"),
        "settings": ("start ms-settings:" if IS_WINDOWS else "gnome-control-center"),
        "control panel": ("control.exe" if IS_WINDOWS else "gnome-control-center"),
        "snipping tool": ("snippingtool.exe" if IS_WINDOWS else "gnome-screenshot -i"),
        "screenshot": ("snippingtool.exe" if IS_WINDOWS else "gnome-screenshot -i"),
    }

    for app_kw, app_cmd in app_map.items():
        if f"open {app_kw}" in cmd or f"launch {app_kw}" in cmd or f"start {app_kw}" in cmd:
            try:
                if IS_WINDOWS:
                    subprocess.Popen(app_cmd, shell=True, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
                else:
                    subprocess.Popen(app_cmd.split(), start_new_session=True)
                return {"success": True, "message": f"Opening {app_kw.title()}..."}
            except Exception as ex:
                return {"success": False, "message": f"Failed to open {app_kw}: {ex}"}

    # Open URL / website
    url_match = re.search(r'open\s+(https?://\S+|www\.\S+)', cmd)
    if url_match:
        url = url_match.group(1)
        if not url.startswith('http'):
            url = 'https://' + url
        webbrowser.open(url)
        return {"success": True, "message": f"Opening {url} in browser..."}

    # Shutdown
    if "shutdown" in cmd or "shut down" in cmd or "power off" in cmd:
        if IS_WINDOWS:
            subprocess.Popen("shutdown /s /t 5", shell=True)
        else:
            subprocess.Popen("shutdown -h 5", shell=True)
        return {"success": True, "message": "⚠️ System shutting down in 5 seconds..."}

    # Restart
    if "restart" in cmd or "reboot" in cmd:
        if IS_WINDOWS:
            subprocess.Popen("shutdown /r /t 5", shell=True)
        else:
            subprocess.Popen("reboot", shell=True)
        return {"success": True, "message": "⚠️ System restarting in 5 seconds..."}

    # Sleep
    if "sleep" in cmd or "hibernate" in cmd:
        if IS_WINDOWS:
            subprocess.Popen("rundll32.exe powrprof.dll,SetSuspendState 0,1,0", shell=True)
        else:
            subprocess.Popen("systemctl suspend", shell=True)
        return {"success": True, "message": "Putting system to sleep..."}

    # Cancel shutdown
    if "cancel shutdown" in cmd or "abort shutdown" in cmd:
        if IS_WINDOWS:
            subprocess.Popen("shutdown /a", shell=True)
        else:
            subprocess.Popen("shutdown -c", shell=True)
        return {"success": True, "message": "Shutdown cancelled."}

    # Volume Controls
    if "mute" in cmd or "unmute" in cmd:
        if IS_WINDOWS:
            if pyautogui:
                try: pyautogui.press("volumemute")
                except Exception: pass
            else:
                subprocess.run(['powershell', '-NoProfile', '-Command', '(New-Object -ComObject WScript.Shell).SendKeys([char]173)'], capture_output=True)
        else:
            subprocess.run("pactl set-sink-mute @DEFAULT_SINK@ toggle || amixer set Master toggle", shell=True, stderr=subprocess.DEVNULL)
        return {"success": True, "message": "System audio mute toggled."}

    vol_match = re.search(r'set\s+(?:system\s+)?volume\s+to\s+(\d+)', cmd)
    if vol_match:
        target_vol = max(0, min(100, int(vol_match.group(1))))
        if IS_WINDOWS:
            try:
                from ctypes import cast, POINTER
                from comtypes import CLSCTX_ALL
                from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = cast(interface, POINTER(IAudioEndpointVolume))
                volume.SetMasterVolumeLevelScalar(target_vol / 100.0, None)
            except Exception:
                pass
        else:
            subprocess.run(f"pactl set-sink-volume @DEFAULT_SINK@ {target_vol}% || amixer set Master {target_vol}%", shell=True, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"System volume set to {target_vol}%."}

    # Folder / File Creation
    if "create folder" in cmd or "make a folder" in cmd:
        folder_name = re.sub(r'^(create folder|make a folder called|create a folder named)\s+', '', cmd).strip()
        folder_path = desktop_path / folder_name
        folder_path.mkdir(parents=True, exist_ok=True)
        return {"success": True, "message": f"Created folder '{folder_name}' on Desktop."}

    if "create file" in cmd or "make a file" in cmd:
        file_name = re.sub(r'^(create file|make a file called|create a file named)\s+', '', cmd).strip()
        if "." not in file_name: file_name += ".txt"
        file_path = desktop_path / file_name
        file_path.touch(exist_ok=True)
        return {"success": True, "message": f"Created file '{file_name}' on Desktop."}

    # Lock Screen
    if "lock computer" in cmd or "lock screen" in cmd:
        if IS_WINDOWS and hasattr(ctypes, "windll"):
            ctypes.windll.user32.LockWorkStation()
        else:
            subprocess.Popen("xdg-screensaver lock || loginctl lock-session || gnome-screensaver-command -l 2>/dev/null", shell=True)
        return {"success": True, "message": "Workstation locked."}

    # Jokes
    if "joke" in cmd and pyjokes:
        joke = pyjokes.get_joke()
        return {"success": True, "message": joke, "is_joke": True}

    # Wikipedia
    if cmd.startswith("wikipedia ") and wikipedia:
        query = cmd.replace("wikipedia ", "").strip()
        try:
            summary = wikipedia.summary(query, sentences=3)
            return {"success": True, "message": summary, "type": "wikipedia", "query": query}
        except Exception:
            return {"success": False, "message": f"No direct Wikipedia match for '{query}'."}

    return {"success": False, "message": "Command not recognized as local system action."}


# ----------------- SUPERVISOR FACT-CHECKER -----------------
def run_supervisor_fact_check(prompt: str, local_answer: str, cloud_model: str) -> Optional[str]:
    """Runs verification using Gemini to verify and correct Ollama's response if wrong.
    Uses bounded non-blocking execution so local Ollama responses are never delayed.
    """
    client = get_gemini_client()
    if not client or not local_answer or len(local_answer) < 5:
        return None

    verification_prompt = (
        f"A user asked this query: '{prompt}'\n"
        f"An AI answered with this: '{local_answer}'\n\n"
        "Is the AI's answer factually correct, logical, and reasonably complete?\n"
        "If YES, reply with EXACTLY the single word 'CORRECT'.\n"
        "If NO, reply with 'INCORRECT:' followed by a clear, accurate, and direct correction of the fact."
    )

    # Build the model chain: prefer the passed cloud_model, then the full chain.
    chain = build_gemini_chain(cloud_model)

    from concurrent.futures import ThreadPoolExecutor, TimeoutError
    def _execute():
        try:
            used_model, resp = gemini_generate_with_fallback(client, verification_prompt, preferred_models=chain)
            verdict = resp.text.strip()
            if verdict.upper().startswith("INCORRECT"):
                return verdict.replace("INCORRECT:", "").replace("INCORRECT", "").strip()
            print(f"Supervisor used model: {used_model} -> CORRECT")
        except Exception as e:
            print(f"Supervisor Fact Check Error: {e}")
        return None

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            fut = executor.submit(_execute)
            return fut.result(timeout=3.5)
    except TimeoutError:
        print("Supervisor check timed out (releasing response immediately)")
        return None
    except Exception as ex:
        print(f"Supervisor execution error: {ex}")
        return None


# ----------------- CHAT & MULTIMODAL REASONING -----------------
def generate_ai_response(
    prompt: str,
    history: List[Dict[str, str]],
    persona_key: str = "master_vedas",
    model_override: Optional[str] = None,
    use_web_search: bool = False,
    enable_thinking: bool = True,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    global memory

    persona_prompt = PERSONAS.get(persona_key, PERSONAS["master_vedas"])
    mem_notes = memory.get("notes", [])
    mem_context = "\n".join([f"- {n}" for n in mem_notes[-10:]]) if mem_notes else "No notes stored."

    # Perform web search if requested
    search_context = ""
    if use_web_search or prompt.lower().startswith("search for ") or prompt.lower().startswith("browse "):
        search_query = re.sub(r'^(search for |browse |google |find info on )', '', prompt, flags=re.I).strip()
        if search_query and DDGS:
            try:
                results = []
                with DDGS() as ddgs:
                    for r in ddgs.text(search_query, max_results=4):
                        results.append(f"Title: {r.get('title')}\nSnippet: {r.get('body')}\nURL: {r.get('href')}")
                if results:
                    search_context = "\n\n=== Live Web Search Results ===\n" + "\n---\n".join(results)
            except Exception as e:
                print(f"Web Search Error: {e}")

    # Build history context
    history_lines = []
    for h in history[-8:]:
        role = "User" if h.get("role") == "user" else "Vedas"
        history_lines.append(f"{role}: {h.get('content') or h.get('text', '')}")
    history_text = "\n".join(history_lines)

    # Process Attachments (PDFs, Images, Documents, Code)
    attachment_descriptions = []
    pil_images = []
    has_pdf = False

    # Collect attachments from current prompt OR look back in recent session history
    effective_attachments = list(attachments) if attachments else []
    if not effective_attachments and history:
        for h in reversed(history[-8:]):
            prev_meta = h.get("meta")
            if isinstance(prev_meta, dict):
                prev_atts = prev_meta.get("attachments", [])
                if prev_atts:
                    effective_attachments = prev_atts
                    break

    if effective_attachments:
        for att in effective_attachments:
            name = att.get("name", "file")
            att_type = att.get("type", "")
            data_b64 = att.get("data", "")
            text_content = att.get("text_content", "")

            if att.get("is_pdf") or name.lower().endswith(".pdf") or "pdf" in att_type:
                has_pdf = True
                attachment_descriptions.append(
                    f"=== ATTACHED PDF DOCUMENT: '{name}' ===\n"
                    "INSTRUCTIONS: The text below is extracted from an attached PDF document. "
                    "When questions, exercises, or exam problems appear in this document, directly solve them "
                    "and provide clear, complete answers or the full answer key as requested by the user.\n\n"
                    f"{text_content}\n"
                    "=== END OF PDF ==="
                )
            elif text_content:
                attachment_descriptions.append(f"=== ATTACHED FILE: '{name}' ===\n```{att_type}\n{text_content[:8000]}\n```")
            elif "image" in att_type and data_b64:
                try:
                    if "," in data_b64:
                        data_b64 = data_b64.split(",")[1]
                    img_bytes = base64.b64decode(data_b64)
                    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    pil_images.append(pil_img)
                    attachment_descriptions.append(f"[Photo Attachment: '{name}']")
                except Exception as e:
                    attachment_descriptions.append(f"[Photo Attachment Error: {e}]")

    att_context = "\n\n".join(attachment_descriptions)

    # Clean, Natural Prompt Assembly
    prompt_sections = []
    if persona_prompt:
        prompt_sections.append(persona_prompt)
    if mem_context and mem_context != "No notes stored.":
        prompt_sections.append(f"=== Memory Bank ===\n{mem_context}")
    if history_text:
        prompt_sections.append(f"=== Conversation History ===\n{history_text}")
    if search_context:
        prompt_sections.append(f"{search_context}")
    if att_context:
        prompt_sections.append(f"{att_context}")

    prompt_sections.append(f"User: {prompt}\nVedas:")
    full_prompt = "\n\n".join(prompt_sections)

    active_local_model = APP_CONFIG["local_model"]
    active_cloud_model = APP_CONFIG["cloud_model"]
    gemini_client = get_gemini_client()

    # If user explicitly picked Gemini model
    if model_override and "gemini" in model_override.lower():
        active_cloud_model = model_override
        if gemini_client:
            contents = [full_prompt] + pil_images if pil_images else full_prompt
            config = {"automatic_function_calling": {"disable": True}}
            try:
                # Direct invocation of user's explicitly selected Gemini model
                resp = gemini_client.models.generate_content(
                    model=active_cloud_model,
                    contents=contents,
                    config=config
                )
                return {
                    "source": "gemini_direct",
                    "model": active_cloud_model,
                    "text": resp.text.strip(),
                    "search_used": bool(search_context)
                }
            except Exception as e:
                # If explicitly chosen model fails (e.g. quota limit or temporary overload),
                # attempt fallback to other available models in the chain and alert the user.
                print(f"Explicit Gemini model '{active_cloud_model}' failed ({type(e).__name__}: {e}). Trying fallback...")
                fallback_chain = [m for m in GEMINI_MODEL_CHAIN if m != active_cloud_model]
                try:
                    used_model, resp = gemini_generate_with_fallback(gemini_client, contents, preferred_models=fallback_chain)
                    err_msg = str(e)
                    short_reason = "Quota limit reached" if ("429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg) else type(e).__name__
                    return {
                        "source": "gemini_direct",
                        "model": used_model,
                        "text": resp.text.strip(),
                        "supervisor_alert": f"Requested '{active_cloud_model}' was unavailable ({short_reason}). Automatically routed to {used_model}.",
                        "search_used": bool(search_context)
                    }
                except Exception as fb_err:
                    return {
                        "source": "error",
                        "model": active_cloud_model,
                        "text": f"⚠️ Gemini Cloud Error ({active_cloud_model}): {str(e)}",
                        "search_used": False
                    }

    # If images are attached and Gemini is available, prioritize Gemini Vision for best multimodal image comprehension
    if pil_images and gemini_client:
        try:
            contents = [full_prompt] + pil_images
            chain = build_gemini_chain(active_cloud_model)
            used_model, resp = gemini_generate_with_fallback(gemini_client, contents, preferred_models=chain)
            active_cloud_model = used_model
            return {
                "source": "gemini_multimodal",
                "model": active_cloud_model,
                "text": resp.text.strip(),
                "search_used": bool(search_context)
            }
        except Exception as e:
            print(f"Gemini Vision Error: {e}")

    # 1. PRIMARY: Query Local Ollama (Major Engine)
    target_ollama_model = model_override if (model_override and "gemini" not in model_override.lower()) else active_local_model

    # Check installed models on the local Ollama daemon (ensure daemon is up)
    installed_models = get_installed_ollama_models()
    if not installed_models:
        ensure_ollama_running()
        installed_models = get_installed_ollama_models()

    if installed_models:
        target_ollama_model = resolve_ollama_model(target_ollama_model, installed_models)

    ollama_text = None
    _t0 = time.time()
    try:
        # Context window expanded to 16,384 tokens for documents; predict tokens expanded for complete answer keys
        ctx_size = 16384 if (has_pdf or len(full_prompt) > 3500) else 8192
        max_predict = 2048 if has_pdf else 600

        ollama_endpoint = APP_CONFIG.get("ollama_host", "http://127.0.0.1:11434")
        res = requests.post(
            f"{ollama_endpoint}/api/generate",
            json={
                "model": target_ollama_model,
                "prompt": full_prompt,
                "stream": False,
                "keep_alive": "60m",
                "options": {
                    "temperature": APP_CONFIG.get("temperature", 0.7),
                    "num_ctx": ctx_size,
                    "num_predict": max_predict
                }
            },
            timeout=120
        )
        if res.status_code == 200:
            ollama_text = res.json().get("response", "").strip()
            print(f"Ollama '{target_ollama_model}' responded in {round(time.time()-_t0,2)}s ({len(ollama_text)} chars)")
        else:
            print(f"Ollama returned HTTP {res.status_code}: {res.text[:120]} (after {round(time.time()-_t0,2)}s)")
    except Exception as e:
        print(f"Ollama inference error/timeout ({target_ollama_model}) after {round(time.time()-_t0,2)}s: {e}")

    if ollama_text:
        ollama_text = re.sub(r'^(?:Vedas|AI):\s*', '', ollama_text, flags=re.I).strip()
        # Non-blocking supervisor fact-check if enabled
        supervisor_correction = None
        if APP_CONFIG.get("supervisor_enabled") and gemini_client:
            try:
                supervisor_correction = run_supervisor_fact_check(prompt, ollama_text, active_cloud_model)
            except Exception as se:
                print(f"Supervisor check ignored: {se}")

        return {
            "source": "ollama",
            "model": target_ollama_model,
            "text": ollama_text,
            "supervisor_alert": supervisor_correction,
            "search_used": bool(search_context)
        }

    # 2. FALLBACK: Cloud Gemini Fallback (if Ollama offline/timeout)
    if gemini_client:
        try:
            chain = build_gemini_chain(active_cloud_model)
            used_model, fallback = gemini_generate_with_fallback(gemini_client, full_prompt, preferred_models=chain)
            active_cloud_model = used_model
            clean_fallback = re.sub(r'^(?:Vedas|AI):\s*', '', fallback.text.strip(), flags=re.I).strip()
            return {
                "source": "gemini_fallback",
                "model": active_cloud_model,
                "text": clean_fallback,
                "search_used": bool(search_context)
            }
        except Exception as e:
            return {
                "source": "error",
                "model": "none",
                "text": f"⚠️ Gemini Fallback Error ({active_cloud_model}): {str(e)}\n\n(Ensure Ollama is running with `ollama run {target_ollama_model}`).",
                "search_used": False
            }

    return {
        "source": "offline",
        "model": "none",
        "text": f"⚠️ Both Local Ollama (`{target_ollama_model}`) and Cloud Gemini are currently unreachable.\n\nTo start Ollama locally, run: `ollama run {target_ollama_model}`.",
        "search_used": False
    }


# ----------------- IMAGE GENERATION ENGINE -----------------
STYLE_PROMPT_PRESETS = {
    "cinematic": "cinematic lighting, hyper-realistic, dramatic atmosphere, ultra-detailed 8k render, octane render, masterpiece, Unreal Engine 5 aesthetic, volumetric fog",
    "anime": "stunning anime visual, Makoto Shinkai style, vibrant saturated colors, crisp line art, studio anime aesthetic, beautiful lighting, highly detailed",
    "cyberpunk": "cyberpunk 2077 aesthetic, neon glowing reflections, holographic interfaces, futuristic rainy metropolis, ultra-detailed sci-fi concept art",
    "photorealistic": "award-winning portrait photography, 85mm lens, f/1.4 aperture, natural lighting, ultra-sharp textures, 8k UHD, true-to-life details",
    "3d_render": "Pixar / Disney 3D style, soft clay lighting, ray-traced shadows, cute character design, vibrant cheerful palette, 4k render",
    "digital_art": "epic fantasy digital painting, ArtStation trending, intricate details, vivid color harmonies, smooth brush strokes, concept art",
    "oil_painting": "classic Renaissance oil on canvas, textured brushwork, rich impasto, Rembrandt lighting, timeless museum masterpiece",
    "pixel_art": "detailed 32-bit pixel art, isometric perspective, rich retro palette, nostalgic game aesthetic, pixel-perfect"
}

ASPECT_RATIOS = {
    "1:1": (1024, 1024),
    "16:9": (1280, 720),
    "9:16": (720, 1280),
    "4:3": (1024, 768),
    "3:2": (1080, 720)
}

def generate_image_pollinations(
    prompt: str,
    style: str = "cinematic",
    aspect_ratio: str = "1:1",
    model: str = "flux",
    enhance: bool = True,
    seed: Optional[int] = None
) -> Dict[str, Any]:
    style_modifier = STYLE_PROMPT_PRESETS.get(style, "")
    enhanced_prompt = f"{prompt.strip()}, {style_modifier}" if style_modifier and enhance else prompt.strip()

    width, height = ASPECT_RATIOS.get(aspect_ratio, (1024, 1024))
    if not seed:
        seed = int(time.time() * 1000) % 9999999

    clean_prompt = requests.utils.quote(enhanced_prompt)
    model_name = "flux" if model == "flux" else "turbo"

    # Primary and fallback CDN URLs for Pollinations
    primary_url = (
        f"https://image.pollinations.ai/prompt/{clean_prompt}"
        f"?width={width}&height={height}&model={model_name}&seed={seed}&nologo=true&enhance=false"
    )
    turbo_fallback_url = (
        f"https://image.pollinations.ai/prompt/{clean_prompt}"
        f"?width={width}&height={height}&model=turbo&seed={seed}&nologo=true&enhance=false"
    )

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; VedasAI/3.0)",
        "Accept": "image/webp,image/jpeg,image/*"
    })

    # Attempt primary URL with up to 2 retries, then fallback model, then return CDN URL directly
    for attempt_url in [primary_url, turbo_fallback_url]:
        for attempt in range(2):
            try:
                resp = session.get(attempt_url, timeout=45, stream=False)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    content_type = resp.headers.get("Content-Type", "image/jpeg")
                    ext = "png" if "png" in content_type else "jpeg"
                    b64_img = base64.b64encode(resp.content).decode("utf-8")
                    data_uri = f"data:image/{ext};base64,{b64_img}"
                    return {
                        "success": True,
                        "url": attempt_url,
                        "data_uri": data_uri,
                        "enhanced_prompt": enhanced_prompt,
                        "width": width,
                        "height": height,
                        "seed": seed,
                        "style": style
                    }
                elif resp.status_code in (429, 503):
                    print(f"Pollinations rate limited (attempt {attempt+1}), retrying...")
                    time.sleep(2)
            except requests.exceptions.Timeout:
                print(f"Pollinations timeout on attempt {attempt+1}, retrying...")
                time.sleep(1)
            except Exception as e:
                print(f"Image fetch error (attempt {attempt+1}): {e}")
                break

    # Final fallback: return the CDN URL directly so the browser can load it
    # (works fine since Pollinations has CORS headers on their CDN)
    print("Returning direct Pollinations CDN URL as fallback (browser will load it).")
    return {
        "success": True,
        "url": primary_url,
        "data_uri": primary_url,
        "enhanced_prompt": enhanced_prompt,
        "width": width,
        "height": height,
        "seed": seed,
        "style": style
    }


# ----------------- API ENDPOINTS -----------------

@app.get("/api/system/status")
def get_system_status():
    installed = get_installed_ollama_models()
    ollama_running = len(installed) > 0
    if not ollama_running:
        for probe in ["http://127.0.0.1:11434", APP_CONFIG.get("ollama_host", "http://127.0.0.1:11434")]:
            try:
                res = requests.get(f"{probe}/api/tags", timeout=1.0)
                if res.status_code == 200:
                    ollama_running = True
                    break
            except Exception:
                pass

    gemini_online = bool(get_gemini_client())

    # Known stable Ollama models always exposed in the UI (in addition to what's installed),
    # so the user can select and download them. llama3.2 stays the default primary engine.
    known_stable_models = [
        APP_CONFIG.get("local_model", "llama3.2:latest"),
        "llama3.2:latest",
        "llama3:latest",
        "qwen2.5:7b",
        "phi4:latest",
    ]
    combined_models = list(dict.fromkeys(installed + known_stable_models))

    # Gemini cloud models exposed to the UI with friendly display names.
    # Order matches the fallback chain (3.7 first, then down to 3.1 Pro).
    cloud_models = [
        {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash"},
        {"id": "gemini-3.6-flash", "name": "Gemini 3.6 Flash"},
        {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash"},
        {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite"},
        {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash Lite"},
        {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro"},
    ]

    cpu_usage = psutil.cpu_percent(interval=None) if psutil else 0
    if psutil:
        ram = psutil.virtual_memory()
        ram_usage = ram.percent
        ram_gb = round(ram.used / (1024**3), 1)
        ram_total_gb = round(ram.total / (1024**3), 1)
        ram_str = f"{ram_gb} GB / {ram_total_gb} GB"
    else:
        ram_usage = 0
        ram_str = "N/A"

    return {
        "ollama_running": ollama_running,
        "local_models": combined_models if ollama_running else known_stable_models,
        "cloud_models": cloud_models,
        "active_local_model": APP_CONFIG["local_model"],
        "active_cloud_model": APP_CONFIG["cloud_model"],
        "gemini_online": gemini_online,
        "supervisor_enabled": APP_CONFIG.get("supervisor_enabled", True),
        "cpu_usage": cpu_usage,
        "ram_usage": ram_usage,
        "ram_gb": ram_str,
        "system_time": datetime.datetime.now().strftime("%I:%M:%S %p"),
        "platform": "Linux" if IS_LINUX else ("Windows" if IS_WINDOWS else "macOS")
    }

@app.post("/api/ollama/start")
def start_ollama_endpoint():
    started = ensure_ollama_running()
    installed = get_installed_ollama_models()
    return {
        "success": started or len(installed) > 0,
        "running": started or len(installed) > 0,
        "models": installed
    }

@app.get("/api/config")
def get_config():
    return APP_CONFIG

@app.post("/api/config")
def update_config(config_update: Dict[str, Any]):
    global APP_CONFIG
    for k, v in config_update.items():
        if k in APP_CONFIG:
            APP_CONFIG[k] = v
    return {"success": True, "config": APP_CONFIG}

@app.get("/api/memory")
def get_memory_data():
    global memory
    memory = load_memory()
    return memory

@app.post("/api/memory/notes")
def add_note(note_req: NoteRequest):
    global memory
    note = note_req.note.strip()
    if note:
        memory["notes"].append(note)
        save_memory(memory)
        return {"success": True, "notes": memory["notes"]}
    raise HTTPException(status_code=400, detail="Note content cannot be empty.")

@app.delete("/api/memory/notes/{index}")
def delete_note(index: int):
    global memory
    if 0 <= index < len(memory.get("notes", [])):
        removed = memory["notes"].pop(index)
        save_memory(memory)
        return {"success": True, "removed": removed, "notes": memory["notes"]}
    raise HTTPException(status_code=404, detail="Note index out of range.")

@app.delete("/api/memory/clear")
def clear_all_memory():
    global memory
    memory["notes"] = []
    save_memory(memory)
    return {"success": True, "message": "Memory bank notes cleared."}

@app.post("/api/sessions")
def save_session(session_data: Dict[str, Any]):
    global memory
    s_id = session_data.get("id")
    if not s_id:
        s_id = str(int(time.time()))
        session_data["id"] = s_id

    existing_idx = None
    for idx, s in enumerate(memory["sessions"]):
        if s.get("id") == s_id:
            existing_idx = idx
            break

    if existing_idx is not None:
        memory["sessions"][existing_idx] = session_data
    else:
        memory["sessions"].insert(0, session_data)

    save_memory(memory)
    return {"success": True, "session_id": s_id}

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    global memory
    memory["sessions"] = [s for s in memory["sessions"] if s.get("id") != session_id]
    save_memory(memory)
    return {"success": True}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    # Check for direct local system commands (alarms, volume, folder creation, jokes)
    sys_result = execute_system_action(prompt)
    if sys_result.get("success") and not sys_result.get("is_joke"):
        return {
            "source": "system_action",
            "model": "system",
            "text": sys_result.get("message"),
            "action_executed": True
        }

    # Fetch existing conversation history from memory if session_id provided
    history = []
    if req.session_id:
        for s in memory.get("sessions", []):
            if s.get("id") == req.session_id:
                history = s.get("messages", [])
                break

    response_data = generate_ai_response(
        prompt=prompt,
        history=history,
        persona_key=req.persona or APP_CONFIG.get("system_persona", "master_vedas"),
        model_override=req.model_override,
        use_web_search=req.use_web_search or False,
        enable_thinking=req.enable_thinking if req.enable_thinking is not None else True,
        attachments=req.attachments
    )

    return response_data

@app.post("/api/generate-image")
def generate_image_endpoint(req: ImageGenRequest):
    if not req.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required for image generation.")

    result = generate_image_pollinations(
        prompt=req.prompt,
        style=req.style or "cinematic",
        aspect_ratio=req.aspect_ratio or "1:1",
        model=req.model or "flux",
        enhance=req.enhance_prompt if req.enhance_prompt is not None else True,
        seed=req.seed
    )
    return result

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        safe_filename = Path(file.filename).name if file.filename else f"upload_{int(time.time())}"
        file_path = UPLOAD_DIR / safe_filename
        file_path.write_bytes(content)

        file_type = file.content_type or ""
        filename_lower = safe_filename.lower()
        text_content = ""
        is_pdf = False
        page_count = 0

        # Robust, layout-aware PDF parsing with pypdf
        if filename_lower.endswith(".pdf") or "pdf" in file_type:
            is_pdf = True
            if PdfReader:
                try:
                    pdf_reader = PdfReader(io.BytesIO(content))
                    page_count = len(pdf_reader.pages)
                    extracted_pages = []
                    for i, page in enumerate(pdf_reader.pages):
                        try:
                            # Use layout mode to preserve question numbers, options, columns & tables
                            page_text = page.extract_text(extraction_mode="layout")
                        except Exception:
                            page_text = page.extract_text()
                        if page_text and page_text.strip():
                            # Clean vertical runs and excessive spaces
                            cleaned = re.sub(r'\n{3,}', '\n\n', page_text)
                            lines = [re.sub(r'[ \t]{2,}', '  ', l).rstrip() for l in cleaned.split('\n')]
                            final_page = '\n'.join(lines).strip()
                            if final_page:
                                extracted_pages.append(f"--- Page {i+1} ---\n{final_page}")
                    text_content = "\n\n".join(extracted_pages)
                except Exception as pdf_err:
                    print(f"PDF extraction error: {pdf_err}")
                    text_content = f"[PDF Parsing Error: {pdf_err}]"
            else:
                text_content = "[PDF Reader module unavailable]"

        # Handle text, markdown, and code files
        elif any(filename_lower.endswith(ext) for ext in [".txt", ".py", ".js", ".json", ".md", ".csv", ".html", ".css", ".yaml", ".sh", ".c", ".cpp", ".rs"]):
            try:
                text_content = content.decode("utf-8", errors="ignore")
            except Exception:
                pass

        # Handle image files (convert to base64 preview)
        data_b64 = ""
        if "image" in file_type or any(filename_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]):
            data_b64 = f"data:{file_type};base64," + base64.b64encode(content).decode("utf-8")

        return {
            "success": True,
            "filename": safe_filename,
            "size": len(content),
            "content_type": file_type,
            "is_pdf": is_pdf,
            "page_count": page_count,
            "text_content": text_content,
            "data": data_b64,
            "path": str(file_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {e}")

@app.post("/api/execute-code")
def execute_python_code(req: CodeExecRequest):
    code = req.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code string is empty.")

    try:
        start_time = time.time()
        process = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10
        )
        duration = round(time.time() - start_time, 3)

        return {
            "success": process.returncode == 0,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "exit_code": process.returncode,
            "duration": f"{duration}s"
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Execution timed out after 10 seconds.",
            "exit_code": -1,
            "duration": ">10s"
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "exit_code": -1,
            "duration": "0s"
        }

@app.post("/api/search")
def search_web_endpoint(query_req: Dict[str, str]):
    query = query_req.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    results = []
    if DDGS:
        try:
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=6):
                    results.append({
                        "title": r.get("title"),
                        "snippet": r.get("body"),
                        "url": r.get("href")
                    })
        except Exception as e:
            print(f"DDGS Search Error: {e}")

    wiki_summary = None
    if wikipedia:
        try:
            wiki_summary = wikipedia.summary(query, sentences=2)
        except Exception:
            pass

    return {
        "query": query,
        "results": results,
        "wikipedia": wiki_summary
    }

# ----------------- SYSTEM COMMAND ENDPOINT -----------------
@app.post("/api/system/command")
def system_command_endpoint(req: SystemCommandRequest):
    result = execute_system_action(req.command)
    return result

# ----------------- FILE/FOLDER BROWSER ENDPOINTS -----------------
@app.post("/api/files/browse")
def browse_files(req: FileBrowseRequest):
    try:
        target = Path(req.path) if req.path else Path.home()
        if not target.exists():
            raise HTTPException(status_code=404, detail="Path does not exist.")
        if not target.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory.")

        items = []
        for item in sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            try:
                stat = item.stat()
                items.append({
                    "name": item.name,
                    "path": str(item),
                    "is_dir": item.is_dir(),
                    "size": stat.st_size if not item.is_dir() else 0,
                    "modified": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
                })
            except PermissionError:
                pass

        parent = str(target.parent) if target != target.parent else None
        return {
            "current_path": str(target),
            "parent": parent,
            "items": items
        }
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/read")
def read_file(path: str):
    try:
        fp = Path(path)
        if not fp.exists() or not fp.is_file():
            raise HTTPException(status_code=404, detail="File not found.")
        if fp.stat().st_size > 2 * 1024 * 1024:  # 2MB limit
            raise HTTPException(status_code=400, detail="File too large to display (>2MB).")
        content = fp.read_text(encoding="utf-8", errors="replace")
        return {"path": str(fp), "content": content, "name": fp.name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/write")
def write_file(req: FileEditRequest):
    try:
        fp = Path(req.path)
        fp.write_text(req.content, encoding="utf-8")
        return {"success": True, "path": str(fp), "message": f"File saved: {fp.name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/create")
def create_item(req: CreateItemRequest):
    try:
        fp = Path(req.path)
        if req.is_folder:
            fp.mkdir(parents=True, exist_ok=True)
            return {"success": True, "message": f"Folder created: {fp.name}"}
        else:
            fp.parent.mkdir(parents=True, exist_ok=True)
            fp.touch(exist_ok=True)
            return {"success": True, "message": f"File created: {fp.name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/rename")
def rename_item(req: RenameRequest):
    try:
        fp = Path(req.path)
        new_path = fp.parent / req.new_name
        fp.rename(new_path)
        return {"success": True, "new_path": str(new_path), "message": f"Renamed to: {req.new_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files/delete")
def delete_item(path: str):
    import shutil
    try:
        fp = Path(path)
        if not fp.exists():
            raise HTTPException(status_code=404, detail="Path does not exist.")
        if fp.is_dir():
            shutil.rmtree(fp)
        else:
            fp.unlink()
        return {"success": True, "message": f"Deleted: {fp.name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files and fallback index.html
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h2>Vedas AI Server Running. Initializing Web Interface...</h2>")

# Pre-load the default Ollama model into VRAM on startup to eliminate cold-start delay
# Runs in background with retries so server starts even if Ollama is still booting.
def _preload_worker():
    ensure_ollama_running()
    raw_model = APP_CONFIG.get("local_model", "llama3.2:latest")
    installed = get_installed_ollama_models()
    model = resolve_ollama_model(raw_model, installed)
    host = APP_CONFIG.get("ollama_host", "http://127.0.0.1:11434")

    for attempt in range(8):
        try:
            print(f"Pre-loading Ollama model '{model}' into VRAM (attempt {attempt+1}/8)...")
            res = requests.post(
                f"{host}/api/generate",
                json={
                    "model": model,
                    "prompt": "hello",
                    "stream": False,
                    "keep_alive": "60m",
                    "options": {"num_predict": 1}
                },
                timeout=60
            )
            if res.status_code == 200:
                print(f"Model '{model}' loaded and ready in VRAM.")
                return
            elif res.status_code == 404:
                installed = get_installed_ollama_models()
                model = resolve_ollama_model(raw_model, installed)
                print(f"Model preload 404 for '{raw_model}'; re-resolved to '{model}'")
            else:
                print(f"Model preload returned HTTP {res.status_code}")
        except Exception as e:
            print(f"Model preload attempt {attempt+1} failed: {e}")
        time.sleep(2.5)
    print(f"Model preload: Ollama not ready after 8 attempts — will load on first request.")

def preload_ollama_model():
    threading.Thread(target=_preload_worker, daemon=True).start()

preload_ollama_model()

SSL_CERT = CERTS_DIR / "cert.pem"
SSL_KEY = CERTS_DIR / "key.pem"

def ensure_ssl_certs():
    if not SSL_CERT.exists() or not SSL_KEY.exists():
        try:
            cmd = [
                'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                '-keyout', str(SSL_KEY),
                '-out', str(SSL_CERT),
                '-days', '3650',
                '-subj', '/CN=localhost'
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        except Exception as e:
            print(f"SSL generation notice: {e}")

if __name__ == "__main__":
    ensure_ssl_certs()
    print("=" * 60)
    print(" 🚀 VEDAS AI — WEB APPLICATION SERVER (HTTPS SECURE)")
    print(" Local Hub: https://127.0.0.1:8000 (or https://localhost:8000)")
    print(" Primary Engine: Local Ollama (Major) | Supervisor: Gemini")
    print("=" * 60)
    if SSL_CERT.exists() and SSL_KEY.exists():
        uvicorn.run(app, host="0.0.0.0", port=8000, ssl_certfile=str(SSL_CERT), ssl_keyfile=str(SSL_KEY), reload=False)
    else:
        uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
