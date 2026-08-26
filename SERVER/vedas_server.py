import os
import sys
import json
import time
import threading
import subprocess
import webbrowser
import datetime
import requests
import re
import math
import psutil
import base64
import io
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from PIL import Image

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    from google import genai
except ImportError:
    genai = None

try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None

try:
    import wikipedia
except ImportError:
    wikipedia = None

try:
    import pyjokes
except ImportError:
    pyjokes = None

try:
    import pyautogui
except Exception:
    pyautogui = None

IS_WINDOWS = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")

if getattr(sys, 'frozen', False):
    BUNDLE_DIR = Path(sys._MEIPASS)
    STATIC_DIR = BUNDLE_DIR / "static"
    APP_DIR = Path(sys.executable).parent.resolve()
    WORKSPACE_DIR = APP_DIR
    SERVER_DIR = APP_DIR
else:
    SERVER_DIR = Path(__file__).parent.resolve()
    APP_DIR = SERVER_DIR.parent.resolve() if SERVER_DIR.name == "SERVER" else SERVER_DIR
    WORKSPACE_DIR = APP_DIR.parent.resolve()
    STATIC_DIR = APP_DIR / "static"

MEMORY_FILE = APP_DIR / "memory.json"
UPLOAD_DIR = APP_DIR / "uploads"
CERTS_DIR = APP_DIR / "certs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
CERTS_DIR.mkdir(parents=True, exist_ok=True)

def load_env_variables():
    env_paths = [
        APP_DIR / ".env",
        WORKSPACE_DIR / ".env",
        SERVER_DIR / ".env",
        Path.cwd() / ".env"
    ]
    for p in env_paths:
        if p.exists():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

load_env_variables()

APP_CONFIG = {
    "local_model": os.environ.get("LOCAL_MODEL", "llama3.2:latest"),
    "cloud_model": os.environ.get("CLOUD_MODEL", "gemini-3.6-flash"),
    "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
    "ollama_host": os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
    "speech_rate": 1.0,
    "wake_word_enabled": True,
    "supervisor_enabled": os.environ.get("SUPERVISOR_ENABLED", "true").lower() in ("true", "1", "yes"),
    "temperature": 0.7,
    "system_persona": "master_vedas",
    "reasoning_pass": os.environ.get("REASONING_PASS", "true").lower() in ("true", "1", "yes")
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
        try:
            temp_file = MEMORY_FILE.with_suffix(".tmp")
            temp_file.write_text(json.dumps(mem, ensure_ascii=False, indent=2), encoding="utf-8")
            temp_file.replace(MEMORY_FILE)
        except Exception as e:
            print(f"Memory save error: {e}")

memory = load_memory()

def get_gemini_client():
    api_key = APP_CONFIG.get("gemini_api_key", "").strip() or os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        return None
    if not genai:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Gemini Client Init Error: {e}")
        return None

def get_ollama_models() -> List[str]:
    try:
        res = requests.get(f"{APP_CONFIG['ollama_host']}/api/tags", timeout=2)
        if res.status_code == 200:
            models_info = res.json().get("models", [])
            return [m.get("name") for m in models_info if m.get("name")]
    except Exception:
        pass
    return ["llama3.2:latest", "llama3:latest"]

app = FastAPI(title="Vedas AI", version="3.0", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    persona: Optional[str] = "master_vedas"
    model_override: Optional[str] = None
    use_web_search: Optional[bool] = False
    enable_thinking: Optional[bool] = False
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


def execute_system_action(command_str: str) -> Dict[str, Any]:
    cmd = command_str.lower().strip()
    desktop_path = Path.home() / "Desktop"

    if "mute" in cmd:
        if pyautogui:
            try: pyautogui.press("volumemute")
            except Exception: pass
        subprocess.run("pactl set-sink-mute @DEFAULT_SINK@ toggle || amixer set Master toggle", shell=True, stderr=subprocess.DEVNULL)
        return {"success": True, "message": "System audio muted/unmuted."}

    vol_match = re.search(r'set\s+(?:system\s+)?volume\s+to\s+(\d+)', cmd)
    if vol_match:
        target_vol = max(0, min(100, int(vol_match.group(1))))
        subprocess.run(f"pactl set-sink-volume @DEFAULT_SINK@ {target_vol}% || amixer set Master {target_vol}%", shell=True, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"System volume set to {target_vol}%."}

    if "create folder" in cmd or "make a folder" in cmd:
        folder_name = re.sub(r'^(create folder|make a folder called|create a folder named)\s+', '', cmd).strip()
        safe_name = re.sub(r'[^\w\s-]', '', folder_name).strip()
        if safe_name:
            folder_path = desktop_path / safe_name
            folder_path.mkdir(parents=True, exist_ok=True)
            return {"success": True, "message": f"Created folder '{safe_name}' on Desktop."}

    if "create file" in cmd or "make a file" in cmd:
        file_name = re.sub(r'^(create file|make a file called|create a file named)\s+', '', cmd).strip()
        safe_name = re.sub(r'[^\w\s.-]', '', file_name).strip()
        if safe_name:
            if "." not in safe_name: safe_name += ".txt"
            file_path = desktop_path / safe_name
            file_path.touch(exist_ok=True)
            return {"success": True, "message": f"Created file '{safe_name}' on Desktop."}

    if "lock computer" in cmd or "lock screen" in cmd:
        if IS_WINDOWS and hasattr(ctypes, "windll"):
            ctypes.windll.user32.LockWorkStation()
        else:
            subprocess.Popen("xdg-screensaver lock || loginctl lock-session || gnome-screensaver-command -l 2>/dev/null", shell=True)
        return {"success": True, "message": "Workstation locked."}

    if "joke" in cmd and pyjokes:
        joke = pyjokes.get_joke()
        return {"success": True, "message": joke, "is_joke": True}

    if cmd.startswith("wikipedia ") and wikipedia:
        query = cmd.replace("wikipedia ", "").strip()
        try:
            summary = wikipedia.summary(query, sentences=3)
            return {"success": True, "message": summary, "type": "wikipedia", "query": query}
        except Exception:
            return {"success": False, "message": f"No direct Wikipedia match for '{query}'."}

    return {"success": False, "message": "Command not recognized as local system action."}


def run_supervisor_fact_check(prompt: str, local_answer: str, cloud_model: str) -> Optional[str]:
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

    try:
        resp = client.models.generate_content(
            model=cloud_model,
            contents=verification_prompt
        )
        verdict = resp.text.strip()
        if verdict.upper().startswith("INCORRECT"):
            return verdict.replace("INCORRECT:", "").replace("INCORRECT", "").strip()
    except Exception as e:
        print(f"Supervisor Fact Check Error: {e}")
    return None


def generate_ai_response(
    prompt: str,
    history: List[Dict[str, str]],
    persona_key: str = "master_vedas",
    model_override: Optional[str] = None,
    use_web_search: bool = False,
    enable_thinking: bool = False,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    global memory

    persona_prompt = PERSONAS.get(persona_key, PERSONAS["master_vedas"])
    mem_notes = memory.get("notes", [])
    mem_context = "\n".join([f"- {n}" for n in mem_notes[-10:]]) if mem_notes else "No notes stored."

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

    history_lines = []
    for h in history[-8:]:
        role = "User" if h.get("role") == "user" else "Vedas"
        history_lines.append(f"{role}: {h.get('content') or h.get('text', '')}")
    history_text = "\n".join(history_lines)

    attachment_descriptions = []
    pil_images = []
    has_pdf = False

    if attachments:
        for att in attachments:
            name = att.get("name", "file")
            att_type = att.get("type", "")
            data_b64 = att.get("data", "")
            text_content = att.get("text_content", "")

            if att.get("is_pdf") or name.lower().endswith(".pdf") or "pdf" in att_type:
                has_pdf = True
                attachment_descriptions.append(f"=== ATTACHED PDF DOCUMENT: '{name}' ===\n{text_content}\n=== END OF PDF ===")
            elif text_content:
                attachment_descriptions.append(f"=== ATTACHED FILE: '{name}' ===\n```{att_type}\n{text_content[:6000]}\n```")
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

    if model_override and "gemini" in model_override.lower():
        active_cloud_model = model_override
        if gemini_client:
            try:
                contents = [full_prompt] + pil_images if pil_images else full_prompt
                resp = gemini_client.models.generate_content(
                    model=active_cloud_model,
                    contents=contents
                )
                clean_text = re.sub(r'^(?:Vedas|AI):\s*', '', resp.text.strip(), flags=re.I).strip()
                return {
                    "source": "gemini_direct",
                    "model": active_cloud_model,
                    "text": clean_text,
                    "search_used": bool(search_context)
                }
            except Exception as e:
                return {
                    "source": "error",
                    "model": active_cloud_model,
                    "text": f"⚠️ Gemini Cloud Error ({active_cloud_model}): {str(e)}",
                    "search_used": False
                }

    if pil_images and gemini_client:
        try:
            contents = [full_prompt] + pil_images
            resp = gemini_client.models.generate_content(
                model=active_cloud_model,
                contents=contents
            )
            clean_text = re.sub(r'^(?:Vedas|AI):\s*', '', resp.text.strip(), flags=re.I).strip()
            return {
                "source": "gemini_multimodal",
                "model": active_cloud_model,
                "text": clean_text,
                "search_used": bool(search_context)
            }
        except Exception as e:
            print(f"Gemini Vision Error: {e}")

    ollama_models = get_ollama_models()
    target_ollama_model = model_override if (model_override and "gemini" not in model_override.lower()) else active_local_model

    if target_ollama_model not in ollama_models:
        for m in ollama_models:
            if m.startswith(target_ollama_model) or target_ollama_model.startswith(m.split(":")[0]):
                target_ollama_model = m
                break

    ollama_text = None
    try:
        res = requests.post(
            f"{APP_CONFIG['ollama_host']}/api/generate",
            json={
                "model": target_ollama_model,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": APP_CONFIG.get("temperature", 0.7)
                }
            },
            timeout=45
        )
        if res.status_code == 200:
            ollama_text = res.json().get("response", "").strip()
    except Exception as e:
        print(f"Ollama inference error/timeout ({target_ollama_model}): {e}")

    if ollama_text:
        ollama_text = re.sub(r'^(?:Vedas|AI):\s*', '', ollama_text, flags=re.I).strip()
        supervisor_correction = None
        if APP_CONFIG.get("supervisor_enabled") and gemini_client:
            supervisor_correction = run_supervisor_fact_check(prompt, ollama_text, active_cloud_model)

        return {
            "source": "ollama",
            "model": target_ollama_model,
            "text": ollama_text,
            "supervisor_alert": supervisor_correction,
            "search_used": bool(search_context)
        }

    if gemini_client:
        try:
            fallback = gemini_client.models.generate_content(
                model=active_cloud_model,
                contents=full_prompt
            )
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
        "text": f"⚠️ Both Local Ollama (`{target_ollama_model}`) and Cloud Gemini are unreachable.\n\nStart Ollama locally with: `ollama run {target_ollama_model}`.",
        "search_used": False
    }


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
    image_url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width={width}&height={height}&model={model_name}&seed={seed}&nologo=true&enhance=false"

    try:
        resp = requests.get(image_url, timeout=30)
        if resp.status_code == 200:
            b64_img = base64.b64encode(resp.content).decode("utf-8")
            data_uri = f"data:image/jpeg;base64,{b64_img}"
            return {
                "success": True,
                "url": image_url,
                "data_uri": data_uri,
                "enhanced_prompt": enhanced_prompt,
                "width": width,
                "height": height,
                "seed": seed,
                "style": style
            }
    except Exception as e:
        print(f"Direct image fetch error: {e}")

    return {
        "success": True,
        "url": image_url,
        "data_uri": image_url,
        "enhanced_prompt": enhanced_prompt,
        "width": width,
        "height": height,
        "seed": seed,
        "style": style
    }


@app.get("/api/system/status")
def get_system_status():
    ollama_running = False
    models = []
    try:
        res = requests.get(f"{APP_CONFIG['ollama_host']}/api/tags", timeout=1.5)
        if res.status_code == 200:
            ollama_running = True
            models = [m["name"] for m in res.json().get("models", []) if "name" in m]
    except Exception:
        ollama_running = False

    gemini_online = bool(get_gemini_client())

    cpu_usage = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    ram_usage = ram.percent
    ram_gb = round(ram.used / (1024**3), 1)
    ram_total_gb = round(ram.total / (1024**3), 1)

    return {
        "ollama_running": ollama_running,
        "local_models": models if models else ["llama3.2:latest", "llama3:latest"],
        "active_local_model": APP_CONFIG["local_model"],
        "active_cloud_model": APP_CONFIG["cloud_model"],
        "gemini_online": gemini_online,
        "supervisor_enabled": APP_CONFIG.get("supervisor_enabled", True),
        "cpu_usage": cpu_usage,
        "ram_usage": ram_usage,
        "ram_gb": f"{ram_gb} GB / {ram_total_gb} GB",
        "system_time": datetime.datetime.now().strftime("%I:%M:%S %p"),
        "platform": "Linux" if IS_LINUX else ("Windows" if IS_WINDOWS else "macOS")
    }

@app.get("/api/config")
def get_config():
    safe_config = {k: v for k, v in APP_CONFIG.items() if k != "gemini_api_key"}
    safe_config["has_gemini_key"] = bool(APP_CONFIG.get("gemini_api_key"))
    return safe_config

@app.post("/api/config")
def update_config(config_update: Dict[str, Any]):
    global APP_CONFIG
    for k, v in config_update.items():
        if k in APP_CONFIG:
            APP_CONFIG[k] = v
    return {"success": True, "config": get_config()}

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

    sys_result = execute_system_action(prompt)
    if sys_result.get("success") and not sys_result.get("is_joke"):
        return {
            "source": "system_action",
            "model": "system",
            "text": sys_result.get("message"),
            "action_executed": True
        }

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
        enable_thinking=req.enable_thinking if req.enable_thinking is not None else False,
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
        safe_filename = os.path.basename(file.filename)
        if not safe_filename:
            safe_filename = f"upload_{int(time.time())}.dat"

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size exceeds maximum 50MB limit.")

        file_path = UPLOAD_DIR / safe_filename
        file_path.write_bytes(content)

        file_type = file.content_type or ""
        filename_lower = safe_filename.lower()
        text_content = ""
        is_pdf = False
        page_count = 0

        if filename_lower.endswith(".pdf") or "pdf" in file_type:
            is_pdf = True
            if PdfReader:
                try:
                    pdf_reader = PdfReader(io.BytesIO(content))
                    page_count = len(pdf_reader.pages)
                    extracted_pages = []
                    for i, page in enumerate(pdf_reader.pages):
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            extracted_pages.append(f"--- Page {i+1} ---\n{page_text.strip()}")
                    text_content = "\n\n".join(extracted_pages)
                except Exception as pdf_err:
                    print(f"PDF extraction error: {pdf_err}")
                    text_content = f"[PDF Parsing Error: {pdf_err}]"
            else:
                text_content = "[PDF Reader module unavailable]"

        elif any(filename_lower.endswith(ext) for ext in [".txt", ".py", ".js", ".json", ".md", ".csv", ".html", ".css", ".yaml", ".sh", ".c", ".cpp", ".rs"]):
            try:
                text_content = content.decode("utf-8", errors="ignore")
            except Exception:
                pass

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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {e}")

@app.post("/api/execute-code")
def execute_python_code(req: CodeExecRequest):
    code = req.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code string is empty.")

    dangerous_patterns = [
        r'\bshutil\.rmtree\b',
        r'\bos\.system\s*\(\s*["\']rm\s+-rf\b',
        r'\bos\.remove\s*\(\s*["\']/[a-z]',
        r':\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:'
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            return {
                "success": False,
                "stdout": "",
                "stderr": "Security Guardrail: Execution blocked due to potentially harmful system commands.",
                "exit_code": -1,
                "duration": "0s"
            }

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

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h2>Vedas AI Server Running. Initializing Web Interface...</h2>")

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

def open_browser_delayed():
    time.sleep(1.2)
    url = "https://127.0.0.1:8000"
    print(f"\n🌐 Launching Vedas AI Web Interface at {url} ...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Browser launch notice: {e}")

if __name__ == "__main__":
    ensure_ssl_certs()
    threading.Thread(target=open_browser_delayed, daemon=True).start()
    print("=" * 60)
    print(" 🚀 VEDAS AI — WEB APPLICATION SERVER (HTTPS SECURE)")
    print(" Local Hub: https://127.0.0.1:8000 (or https://localhost:8000)")
    print(" Primary Engine: Local Ollama (Major) | Supervisor: Gemini")
    print("=" * 60)
    if SSL_CERT.exists() and SSL_KEY.exists():
        uvicorn.run(app, host="0.0.0.0", port=8000, ssl_certfile=str(SSL_CERT), ssl_keyfile=str(SSL_KEY), reload=False)
    else:
        uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
