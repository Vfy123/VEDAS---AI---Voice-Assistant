import os
import sys
import json
import time
import threading
import subprocess
import webbrowser
import datetime
import requests
import ctypes
import psutil
import queue
from pathlib import Path
import re
import pyaudio
import numpy as np
import pyautogui
import speech_recognition as sr
import pywhatkit
import wikipedia
import pyjokes
import customtkinter as ctk
from google import genai
import math

IS_WINDOWS = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")

# Windows-only sound library fallback
try:
    import winsound
except ImportError:
    winsound = None

# Windows audio control fallback
try:
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
except ImportError:
    AudioUtilities = None
    IAudioEndpointVolume = None
    CLSCTX_ALL = None

# Windows COM threading
try:
    import pythoncom
except ImportError:
    pythoncom = None

# config and memory
APP_DIR = Path(__file__).parent.resolve()
MEMORY_FILE = APP_DIR / "memory.json"
WAKE_WORDS = ["hello google", "hey google", "ok google", "okay google", "vedas"]

# models 
APP_CONFIG = {
    "local_model": "llama3",
    "cloud_model": "gemini-3.6-flash"
}

# google api
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "") 

if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_API_KEY_HERE" and GEMINI_API_KEY != "your api key here":
    print("WARNING: Valid API Key not found. Cloud fallback disabled.")

_memory_lock = threading.Lock()

def load_memory():
    default_mem = {"notes": [], "sessions": []}
    if MEMORY_FILE.exists():
        try:
            data = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
            if "sessions" not in data: data["sessions"] = []
            if "notes" not in data: data["notes"] = []
            return data
        except Exception:
            return default_mem
    return default_mem

def save_memory(mem):
    with _memory_lock:
        MEMORY_FILE.write_text(json.dumps(mem, ensure_ascii=False, indent=2), encoding="utf-8")

memory = load_memory()


def speak(text, block=False):
    def _speak_worker(speech_text):
        if 'app' in globals() and app: app.set_waveform_state("speaking", True)
        try:
            import pyttsx3
            import re
            if pythoncom:
                pythoncom.CoInitialize()
            
            clean_text = re.sub(r'[*#_~-]', '', speech_text)
            clean_text = clean_text.replace('\n', '. ')
            
            if IS_WINDOWS:
                engine = pyttsx3.init('sapi5')
                voices = engine.getProperty('voices')
                if voices:
                    engine.setProperty('voice', voices[0].id)
                engine.setProperty('rate', 250)
            else:
                engine = pyttsx3.init()
                engine.setProperty('rate', 175)
            
            engine.say(clean_text)
            engine.runAndWait()
        except Exception as e:
            print(f"TTS Error: {e}")
        finally:
            if pythoncom:
                pythoncom.CoUninitialize()
            if 'app' in globals() and app: app.set_waveform_state("speaking", False)

    tts_thread = threading.Thread(target=_speak_worker, args=(text,), daemon=True)
    tts_thread.start()
    
    if block:
        tts_thread.join()

# Speech-to-Text STT Engine 
listener = sr.Recognizer()
def take_command(log_fn, timeout= 7, phrase_time_limit=30, ambient_duration=0.5):
    if 'app' in globals() and app: app.set_waveform_state("listening", True)
    try:
        with sr.Microphone() as source:
            listener.dynamic_energy_threshold = True
            listener.energy_threshold = 300
            listener.pause_threshold = 2.5 
            listener.adjust_for_ambient_noise(source, duration=ambient_duration)
            log_fn("Microphone Active: Speak now...")
            audio = listener.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
        try:
            text = listener.recognize_google(audio, language="en-US")
            log_fn(f"You: '{text}'")
            return text.lower().strip()
        except sr.UnknownValueError:
            return ""
        except sr.RequestError:
            log_fn("ERROR: Google Speech API unreachable. Check Wi-Fi.")
            return ""
    except sr.WaitTimeoutError:
        return ""
    except Exception as e:
        log_fn(f"MIC ERROR: {e}")
        return ""
    finally:
        if 'app' in globals() and app: app.set_waveform_state("listening", False)
    
# AI fact checker and checker for Ollama responses 
def ask_ai(prompt, history_messages=None):
    if history_messages is None: history_messages = []
    
    ollama_response_text = None
    # models name
    active_local_model = APP_CONFIG["local_model"]
    active_cloud_model = APP_CONFIG["cloud_model"]
    client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
    
    mem_context = " ".join(memory.get("notes", []))
    
    history_context = ""
    for m in history_messages[-8:]:
        role = "User" if m["role"] == "user" else "AI"
        history_context += f"{role}: {m['text']}\n"
    
    if mem_context or history_context:
        full_prompt = f"System Memory Context: {mem_context}\n\nChat History:\n{history_context}\nUser Query: {prompt}\n(Keep your answer concise but complete.)"
    else:
        full_prompt = f"User Query: {prompt}\n(Keep your answer concise but complete.)"
        
    # ollama answer 
    try:
        res = requests.post("http://localhost:11434/api/generate",
                            json={"model": active_local_model, "prompt": full_prompt, "stream": False},
                            timeout=15) # Reduced timeout for faster failover
        if res.status_code == 200:
            ollama_response_text = res.json().get("response", "").strip()
    except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
        pass 

    # fallback
    if not ollama_response_text:
        if client:
            try:
                fallback = client.models.generate_content(
                    model=active_cloud_model,
                    contents=full_prompt
                )
                return f"[Gemini Override - {active_cloud_model}] Local AI offline.\n\n" + fallback.text
            except Exception as e:
                return f"API Error: {e}"
        return "Both Local AI and Cloud AI are offline."

    # Return immediately without fact-checking here
    return f"[{active_local_model}] " + ollama_response_text
#fact check block 
def background_fact_check(prompt, local_answer, active_cloud_model, log_fn):
    """Runs silently in the background to verify Ollama's answer using Gemini."""
    client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
    if not client or "[Gemini Override" in local_answer: 
        return 

    verification_prompt = (
        f"A user asked this query: '{prompt}'\n"
        f"An AI answered with this: '{local_answer}'\n"
        "Is the AI's answer factually correct and reasonably complete? "
        "If YES, reply with EXACTLY the word 'CORRECT'. "
        "If NO, reply with 'INCORRECT' and then provide a completely new, correct, and full answer. "
        "DO NOT critique the AI's mistake, just provide the correct response."
    )
    
    try:
        verification_response = client.models.generate_content(
            model=active_cloud_model,
            contents=verification_prompt
        )
        verification = verification_response.text.strip()
        
        if verification.upper().startswith("INCORRECT"):
            corrected_text = verification[9:].strip(" :-\n")
            alert_msg = f"[Supervisor Alert] Correction required:\n\n{corrected_text}"
            log_fn(alert_msg)
            speak("Wait, let me correct my previous statement. " + corrected_text)
            
    except Exception as e:
        log_fn(f"Supervisor Error: {e}")

# ALARM
def start_alarm_thread(target_time_str, log_fn):
    def alarm_worker():
        clean_target = target_time_str.replace(".", "").lower().strip()
        if clean_target.startswith("0"):
            clean_target = clean_target[1:]
        log_fn(f"Action: Background alarm actively waiting for '{clean_target}'.")
        
        while True:
            now = datetime.datetime.now().strftime("%I:%M %p").lower()
            clean_now = now[1:] if now.startswith("0") else now
            if clean_now == clean_target:
                log_fn("ALARM RINGING!")
                speak("Attention! Your alarm is now ringing.", block=True)
                try:
                    if winsound:
                        for _ in range(5):
                            winsound.Beep(1000, 800)
                    else:
                        for _ in range(5):
                            print('\a', end='', flush=True)
                            time.sleep(0.5)
                except Exception as e:
                    log_fn(f"Audio Error: {e}")
                break
            time.sleep(15)
    threading.Thread(target=alarm_worker, daemon=True).start()


# Main Skills & System Commands   
def execute_action(command, log_fn, update_memory_ui_fn):
    command = command.lower().strip()
    # memory
    if command.startswith("remember "):
        note = command.replace("remember ", "", 1).strip()
        if note:
            memory["notes"].append(note)
            save_memory(memory)
            speak("I have saved that to my memory bank.")
            log_fn(f"Action: Saved '{note}' to memory.")
            update_memory_ui_fn()
        return True
    
    if command == "clear memory":
        memory["notes"] = []
        save_memory(memory)
        speak("Memory bank cleared.")
        log_fn("Action: Cleared memory.")
        update_memory_ui_fn()
        return True
    #search
    if command.startswith("search"):
        query = command.replace("search", "", 1).strip()
        for prefix in ["for ", "the meaning of ", "in the sentence "]:
            if query.startswith(prefix):
                query = query[len(prefix):].strip()

        if query:
            webbrowser.open(f"https://www.google.com/search?q={requests.utils.quote(query)}")
            speak(f"Searching the web for {query}")
            log_fn(f"Action: Googled '{query}'")
        else:
            speak("What would you like me to search for?")
        return True

    # system command like shutdown 
    if command in ["shut down computer", "shutdown computer", "turn off computer", "shutdown"]:
        speak("Initiating system shutdown in 15 seconds. Say 'abort shutdown' to cancel.")
        if IS_WINDOWS:
            os.system("shutdown /s /t 15")
        else:
            os.system("shutdown +1")
        log_fn("Action: Initiated Shutdown sequence.")
        return True

    if command in ["abort shutdown", "cancel shutdown", "stop shutdown"]:
        if IS_WINDOWS:
            os.system("shutdown /a")
        else:
            os.system("shutdown -c")
        speak("Shutdown sequence aborted.")
        log_fn("Action: Aborted Shutdown.")
        return True

    if command in ["restart computer", "restart system", "restart"]:
        speak("Restarting the system in 15 seconds. Say 'abort shutdown' to cancel.")
        if IS_WINDOWS:
            os.system("shutdown /r /t 15")
        else:
            os.system("shutdown -r +1")
        log_fn("Action: Initiated Restart sequence.")
        return True

    if "lock computer" in command or "lock screen" in command:
        speak("Locking the workstation.")
        if IS_WINDOWS and hasattr(ctypes, "windll"):
            ctypes.windll.user32.LockWorkStation()
        else:
            os.system("xdg-screensaver lock || loginctl lock-session || gnome-screensaver-command -l 2>/dev/null")
        log_fn("Action: Locked Workstation.")
        return True
    # alarm command
    if "set an alarm for" in command or "set alarm for" in command:
        match = re.search(r'(\d{1,2}:\d{2}\s*[ap]\.?m\.?)', command)
        
        if match:
            alarm_time = match.group(1)
            speak(f"Setting an alarm for {alarm_time}.")
            log_fn(f"Action: Parsed alarm time as '{alarm_time}'")
            start_alarm_thread(alarm_time, log_fn)
        else:
            speak("I heard you ask for an alarm, but I couldn't understand the exact time. Please say the time clearly, like 5:00 AM.")
            log_fn("Error: Failed to parse time formatting from STT engine.")
            
        return True

# file and folder path
    desktop_path = Path.home() / "Desktop"

    #Folder
    if command.startswith("create a folder") or command.startswith("make a folder called"):
        folder_name = re.sub(r'^(create folder|make a folder called)\s+', '', command).strip()
        target_path = desktop_path / folder_name
        
        target_path.mkdir(parents=True, exist_ok=True)
        speak(f"I have created a folder named {folder_name} on your desktop.")
        log_fn(f"Action: Created folder at {target_path}")
        return True

    #File
    if command.startswith("create a file") or command.startswith("make a file called"):
        file_name = re.sub(r'^(create file|make a file called)\s+', '', command).strip()
        if "." not in file_name:
            file_name += ".txt"
            
        target_path = desktop_path / file_name
        target_path.touch(exist_ok=True)
        speak(f"File {file_name} created on your desktop.")
        log_fn(f"Action: Created file at {target_path}")
        return True

    # Rename
    if command.startswith("rename"):
        match = re.search(r'rename\s+(?:file|folder)?\s*(.+)\s+to\s+(.+)', command)
        if match:
            old_name = match.group(1).strip()
            new_name = match.group(2).strip()
            
            old_path = desktop_path / old_name
            new_path = desktop_path / new_name
            
            if old_path.exists():
                old_path.rename(new_path)
                speak(f"Renamed successfully to {new_name}.")
                log_fn(f"Action: Renamed '{old_name}' to '{new_name}'")
            else:
                speak(f"I couldn't find anything named {old_name} on your desktop to rename.")
        else:
            speak("To rename something, please say 'rename X to Y'.")
        return True
    # app manegement section

# launching apps
    if command.startswith("launch ") or command.startswith("open app "):
        app_name = command.replace("launch ", "").replace("open app ", "").strip()
        speak(f"Opening {app_name}")
        log_fn(f"Action: Launching {app_name}")
        if IS_WINDOWS:
            os.system(f"start {app_name}")
        else:
            subprocess.Popen([app_name], shell=True)
        return True

# closing apps
    if command.startswith("close app ") or command.startswith("force close "):
        app_name = command.replace("close app ", "").replace("force close ", "").strip()
        speak(f"Attempting to close {app_name}", block=False)
        log_fn(f"Action: Scanning for {app_name} to close...")
        closed = False
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'] and app_name in proc.info['name'].lower():
                    proc.kill()
                    closed = True
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        if closed:
            speak(f"I have closed {app_name}.")
            log_fn(f"Action: Successfully closed {app_name}")
        else:
            speak(f"I couldn't find an active application named {app_name}.")
            log_fn(f"Error: {app_name} not found in process list.")
        return True

#minimize 
    if "minimize all windows" in command or "show desktop" in command:
        speak("Minimizing all windows.")
        log_fn("Action: Minimized all windows.")
        pyautogui.hotkey('win', 'd')
        return True

#system media control
    
    # pause, play,skip media
    if command in ["pause music", "pause the music","pause the video","pause video","play video","play the video", "play music", "play the music", "resume music"]:
        pyautogui.press("playpause")
        speak("Toggling media playback.")
        log_fn("Action: Toggled Play/Pause")
        return True
        
    if command in ["skip track", "skip this track", "next track", "next song"]:
        pyautogui.press("nexttrack")
        speak("Skipping track.")
        log_fn("Action: Skipped to next track")
        return True
        
    if command in ["previous track", "previous song", "go back a track"]:
        pyautogui.press("prevtrack")
        speak("Playing previous track.")
        log_fn("Action: Returned to previous track")
        return True

    # volume 
    if "mute volume" in command or "mute the audio" in command:
        pyautogui.press("volumemute")
        speak("Muting system audio.")
        log_fn("Action: Muted system audio")
        return True

    # volume precentage
    if "set volume to" in command or "set system volume to" in command:
        match = re.search(r'set\s+(?:system\s+)?volume\s+to\s+(\d+)', command)
        if match:
            target_vol = int(match.group(1))
            target_vol = max(0, min(target_vol, 100))
            
            try:
                if IS_WINDOWS and AudioUtilities:
                    devices = AudioUtilities.GetSpeakers()
                    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                    volume = cast(interface, POINTER(IAudioEndpointVolume))
                    volume.SetMasterVolumeLevelScalar(target_vol / 100.0, None)
                else:
                    subprocess.run(f"pactl set-sink-volume @DEFAULT_SINK@ {target_vol}% || amixer set Master {target_vol}%", shell=True, stderr=subprocess.DEVNULL)
                speak(f"System volume set to {target_vol} percent.")
                log_fn(f"Action: Set volume to {target_vol}%")
            except Exception as e:
                speak("I encountered an error adjusting the volume.")
                log_fn(f"Volume Error: {e}")
        else:
            speak("Please specify a percentage, like set volume to 50.")
            log_fn("Error: Failed to parse volume percentage.")
        return True

# normal command open google wale
    if command.startswith("wikipedia "):
        query = command.replace("wikipedia ", "").strip()
        try:
            summary = wikipedia.summary(query, sentences=3)
            speak(summary)
            log_fn(f"Wikipedia: {summary}")
        except Exception:
            speak("I couldn't find a direct match on Wikipedia.")
        return True

    if command.startswith("play "):
        song = command.replace("play ", "").strip()
        speak(f"Playing {song} on YouTube.")
        try:
            pywhatkit.playonyt(song)
        except Exception:
            speak("I encountered an issue connecting to YouTube.")
        return True

    if command.startswith("open "):
        target = command.replace("open ", "").strip()
        if "gmail" in target or "mail" in target:
            webbrowser.open("https://mail.google.com")
            speak("Opening Gmail.")
        else:
            webbrowser.open(f"https://www.google.com/search?q={requests.utils.quote(target)}")
            speak(f"Searching the web for {target}")
        return True

    if "time" in command and "what" in command:
        now = datetime.datetime.now().strftime("%I:%M %p")
        speak(f"The time is {now}.")
        return True
        
    if "joke" in command:
        joke = pyjokes.get_joke()
        speak(joke)
        log_fn(f"Joke: {joke}")
        return True

    return False

class WaveformWidget(ctk.CTkCanvas):
    def __init__(self, master, **kwargs):
        super().__init__(master, bg="#0e0e0e", highlightthickness=0, **kwargs)
        self.phase = 0
        self.activities = set()
        self.active_type = "idle"
        self.after(50, self.animate)

    def set_state(self, state, is_active=True):
        if is_active:
            self.activities.add(state)
        else:
            self.activities.discard(state)
        if "listening" in self.activities:
            self.active_type = "listening"
        elif "speaking" in self.activities:
            self.active_type = "speaking"
        else:
            self.active_type = "idle"

    def animate(self):
        self.delete("all")
        width = self.winfo_width()
        height = self.winfo_height()

        if width <= 1: width = 600
        if height <= 1: height = 60

        center_y = height / 2
        if self.active_type == "idle":
            self.create_line(0, center_y, width, center_y, fill="#8fd3f4", width=2)
            self.after(40, self.animate)
            return

        self.phase += 0.25

        if self.active_type == "speaking":
            base_amp = height * 0.4
        elif self.active_type == "listening":
            base_amp = height * 0.25

        colors = ["#a18cd1", "#8fd3f4", "#fbc2eb"]
        for i, color in enumerate(colors):
            points = []
            freq = 0.02 + (i * 0.01)
            amp = base_amp * (1.0 - (i * 0.2))
            
            for x in range(0, int(width), 3):
                envelope = math.sin(math.pi * (x / width))
                y = center_y + math.sin(x * freq + self.phase + (i * 1.5)) * amp * envelope
                points.append((x, y))
            
            for j in range(len(points)-1):
                self.create_line(points[j][0], points[j][1], points[j+1][0], points[j+1][1], fill=color, width=2)
                
        self.after(40, self.animate)
#GUI
class VedaApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Vedas AI — Command Center")
        self.geometry("1050x700")
        self.resizable(False, False)
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")
        
        self.listening = False
        self.current_session_id = None
        
        self.build_ui()
        self.refresh_memory_ui()
        if memory.get("sessions"):
            self.load_session(memory["sessions"][0]["id"])
        else:
            self.start_new_chat()
            
    def build_ui(self):
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0, fg_color="#1e1e1e")
        self.sidebar_frame.pack(side="left", fill="y")
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="VEDAS AI", font=ctk.CTkFont(size=28, weight="bold"))
        self.logo_label.pack(pady=(40, 5))
        self.version_label = ctk.CTkLabel(self.sidebar_frame, text="Master Control v2.0", font=ctk.CTkFont(size=12), text_color="gray")
        self.version_label.pack(pady=(0, 20))
        self.status_label = ctk.CTkLabel(self.sidebar_frame, text="Status: STANDBY", text_color="#FFcc00", font=ctk.CTkFont(size=14, weight="bold"))
        self.status_label.pack(pady=(0, 20))
        self.new_chat_btn = ctk.CTkButton(self.sidebar_frame, text="+ New Chat", command=self.start_new_chat, fg_color="#333333", hover_color="#444444")
        self.new_chat_btn.pack(pady=(10, 0), padx=15, fill="x")
        self.recent_label = ctk.CTkLabel(self.sidebar_frame, text="Recent", font=ctk.CTkFont(size=14), text_color="gray", anchor="w")
        self.recent_label.pack(pady=(15, 5), padx=15, fill="x")
        self.sidebar_memory_scroll = ctk.CTkScrollableFrame(self.sidebar_frame, fg_color="transparent", corner_radius=0)
        self.sidebar_memory_scroll.pack(fill="both", expand=True, padx=5, pady=5)
        self.main_frame = ctk.CTkFrame(self, corner_radius=15, fg_color="transparent")
        self.main_frame.pack(side="right", fill="both", expand=True, padx=20, pady=20)  
        self.tabview = ctk.CTkTabview(self.main_frame, width=750, height=600)
        self.tabview.pack(fill="both", expand=True)
        self.tabview.add("Terminal")
        self.tabview.add("Memory Bank")
        self.tabview.add("Settings") 
        self.chat_frame = ctk.CTkScrollableFrame(self.tabview.tab("Terminal"), fg_color="#0e0e0e")
        self.chat_frame.pack(pady=(15, 5), padx=15, fill="both", expand=True)
        self.waveform = WaveformWidget(self.tabview.tab("Terminal"), height=50)
        self.waveform.pack(fill="x", padx=15, pady=(0, 5))
        self.mic_controls_frame = ctk.CTkFrame(self.tabview.tab("Terminal"), fg_color="transparent")
        self.mic_controls_frame.pack(fill="x", padx=15, pady=5)
        self.mic_buttons_inner = ctk.CTkFrame(self.mic_controls_frame, fg_color="transparent")
        self.mic_buttons_inner.pack(expand=True)
        self.start_btn = ctk.CTkButton(self.mic_buttons_inner, text="INITIATE MIC", command=self.start_system, fg_color="#00994d", hover_color="#00cc66", height=32, width=150)
        self.start_btn.pack(side="left", padx=10)
        self.stop_btn = ctk.CTkButton(self.mic_buttons_inner, text="STANDBY", command=self.stop_system, fg_color="#992600", hover_color="#cc3300", height=32, width=150)
        self.stop_btn.pack(side="left", padx=10)
        self.input_frame = ctk.CTkFrame(self.tabview.tab("Terminal"), fg_color="transparent")
        self.input_frame.pack(fill="x", padx=15, pady=(5, 15))
        self.manual_entry = ctk.CTkEntry(self.input_frame, placeholder_text="Type a command or question...", height=40)
        self.manual_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.manual_entry.bind('<Return>', self.manual_input)
        self.send_btn = ctk.CTkButton(self.input_frame, text="SEND", command=self.manual_input, width=100, height=40)
        self.send_btn.pack(side="right")
        #memory tab contents
        self.memory_area = ctk.CTkTextbox(self.tabview.tab("Memory Bank"), font=ctk.CTkFont(family="Helvetica", size=14), fg_color="#1a1a2e", text_color="#e0e0e0")
        self.memory_area.pack(pady=15, padx=15, fill="both", expand=True)
        self.memory_area.configure(state="disabled")

        #settings tab contents
        self.settings_frame = ctk.CTkFrame(self.tabview.tab("Settings"), fg_color="transparent")
        self.settings_frame.pack(pady=30, padx=30, fill="both", expand=True)

        #ollama model selection
        self.local_label = ctk.CTkLabel(self.settings_frame, text="Ollama Models :", font=ctk.CTkFont(size=16, weight="bold"))
        self.local_label.grid(row=0, column=0, padx=(0, 20), pady=20, sticky="w")
        self.local_var = ctk.StringVar(value=APP_CONFIG["local_model"])
        self.local_menu = ctk.CTkOptionMenu(
            self.settings_frame, 
            values=[
                "llama3", 
                "mistral", 
                "mixtral", 
                "phi3", 
                "gemma", 
                "qwen2", 
                "codellama",
                "llava",
                "llama3.2:1b"
            ], 
            variable=self.local_var,
            command=self.change_local_model,
            width=200, height=35
        )
        self.local_menu.grid(row=0, column=1, pady=20, sticky="w")

        #gemini model selection
        self.cloud_label = ctk.CTkLabel(self.settings_frame, text="Gemini Models :", font=ctk.CTkFont(size=16, weight="bold"))
        self.cloud_label.grid(row=1, column=0, padx=(0, 20), pady=20, sticky="w")
        self.cloud_var = ctk.StringVar(value=APP_CONFIG["cloud_model"])
        self.cloud_menu = ctk.CTkOptionMenu(
            self.settings_frame, 
            values=[
                "gemini-3.6-flash", 
                "gemini-3.5-flash-lite", 
                "gemini-3.1-pro-preview", 
                "gemini-3.5-flash",
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-3.1-flash-image",
                "gemini-3.1-flash-lite",
                "gemini-3.1-flash",
            ], 
            variable=self.cloud_var,
            command=self.change_cloud_model,
            width=200, height=35
        )
        self.cloud_menu.grid(row=1, column=1, pady=20, sticky="w")

    def set_waveform_state(self, state, is_active=True):
        if hasattr(self, 'waveform'):
            self.waveform.set_state(state, is_active)

    def start_new_chat(self):
        self.current_session_id = None
        for widget in self.chat_frame.winfo_children():
            widget.destroy()
        self.refresh_sidebar_sessions()

    def get_current_session(self):
        if not self.current_session_id:
            new_id = str(int(time.time()))
            new_session = {"id": new_id, "title": "New Conversation", "messages": []}
            memory["sessions"].insert(0, new_session)
            self.current_session_id = new_id
            save_memory(memory)
            self.refresh_sidebar_sessions()
            return new_session
            
        for s in memory["sessions"]:
            if s["id"] == self.current_session_id:
                return s
        return None

    def save_session_msg(self, role, text):
        session = self.get_current_session()
        if not session["messages"] and role == "user":
            session["title"] = text[:25] + "..." if len(text) > 25 else text
        session["messages"].append({"role": role, "text": text})
        save_memory(memory)
        self.refresh_sidebar_sessions()

    def load_session(self, session_id):
        self.current_session_id = session_id
        for widget in self.chat_frame.winfo_children():
            widget.destroy()
            
        session = None
        for s in memory.get("sessions", []):
            if s["id"] == session_id:
                session = s
                break
        if session:
            for msg in session["messages"]:
                if msg["role"] == "user":
                    self.log(f"You: {msg['text']}", is_history_load=True)
                elif msg["role"] == "ai":
                    self.log(f"Vedas: {msg['text']}", is_history_load=True)
                    
        self.refresh_sidebar_sessions()

    def refresh_memory_ui(self):
        self.memory_area.configure(state="normal")
        self.memory_area.delete("1.0", "end")
        if not memory["notes"]:
            self.memory_area.insert("end", "Memory bank is currently empty.\nSay 'remember [something]' to store data here.")
        else:
            for idx, note in enumerate(memory["notes"], 1):
                self.memory_area.insert("end", f"{idx}. {note}\n\n")
        self.memory_area.configure(state="disabled")

    def refresh_sidebar_sessions(self):
        for widget in self.sidebar_memory_scroll.winfo_children():
            widget.destroy()
            
        if not memory.get("sessions"):
            lbl = ctk.CTkLabel(self.sidebar_memory_scroll, text="No recent chats.", text_color="gray", font=ctk.CTkFont(size=12))
            lbl.pack(pady=10, padx=10, anchor="w")
            return

        for session in memory["sessions"]:
            display_text = session.get("title", "New Conversation")
            if len(display_text) > 25: display_text = display_text[:22] + "..." 
            bg_color = "#2b2b2b" if session["id"] == self.current_session_id else "transparent"
            
            btn = ctk.CTkButton(
                self.sidebar_memory_scroll, 
                text=display_text, 
                fg_color=bg_color, 
                hover_color="#333333", 
                text_color="#e0e0e0", 
                anchor="w", 
                font=ctk.CTkFont(size=13),
                command=lambda s_id=session["id"]: self.load_session(s_id)
            )
            btn.pack(pady=2, padx=5, fill="x")

    def log(self, text, is_history_load=False):
        if not is_history_load:
            print(text)

        msg_frame = ctk.CTkFrame(self.chat_frame, fg_color="transparent")
        msg_frame.pack(fill="x", padx=10, pady=10)
        if text.startswith("You:") or text.startswith("User (Typed):"):
            clean_text = text.replace("You:", "").replace("User (Typed):", "").strip().strip("'")
            bubble = ctk.CTkFrame(msg_frame, fg_color="#1f1f1f", corner_radius=20)
            bubble.pack(side="right", padx=10)
            lbl = ctk.CTkLabel(bubble, text=clean_text, text_color="white", font=ctk.CTkFont(size=15), wraplength=450, justify="right")
            lbl.pack(padx=20, pady=12)
            
        elif text.startswith("Vedas:"):
            clean_text = text.replace("Vedas:", "").strip()
            bubble = ctk.CTkFrame(msg_frame, fg_color="black", corner_radius=5)
            bubble.pack(side="left", padx=10)
            lbl = ctk.CTkLabel(bubble, text=clean_text, text_color="white", font=ctk.CTkFont(size=15), wraplength=550, justify="left")
            lbl.pack(padx=20, pady=15)

        elif text.startswith("[Supervisor Alert] Correction required:"):
                    clean_text = text.replace("Vedas:", "").strip()
                    bubble = ctk.CTkFrame(msg_frame, fg_color="black", corner_radius=5)
                    bubble.pack(side="left", padx=10)
                    lbl = ctk.CTkLabel(bubble, text=clean_text, text_color="white", font=ctk.CTkFont(size=15), wraplength=550, justify="left")
                    lbl.pack(padx=20, pady=15)
            
        else:
            lbl = ctk.CTkLabel(msg_frame, text=text, text_color="#555555", font=ctk.CTkFont(family="Consolas", size=12), wraplength=600, justify="center")
            lbl.pack(side="top", pady=2)

        if not is_history_load:
            self.chat_frame.after(15, self._scroll_to_bottom)
        else:
            self.chat_frame._parent_canvas.yview_moveto(1.0)

    def _scroll_to_bottom(self):
        self.chat_frame._parent_canvas.yview_moveto(1.0)

    def process_command(self, command):
        if not command:
            return 
        self.save_session_msg("user", command)
        if execute_action(command, self.log, self.refresh_memory_ui):
            return    
        self.log("Querying Local Core...")
        session = self.get_current_session()
        raw_response = ask_ai(command, history_messages=session["messages"][:-1])
        ai_response = re.sub(r'\[.*?\]\s*', '', raw_response).strip()
        self.save_session_msg("ai", ai_response)
        
        self.log(f"Vedas: {ai_response}")
        speak(ai_response)
        threading.Thread(
            target=background_fact_check, 
            args=(command, raw_response, APP_CONFIG["cloud_model"], self.log),
            daemon=True
        ).start()


    def passive_listening_loop(self):
        self.log("Microphones hot. Waiting for wake word: 'Hello Google'")
        while self.listening:
            self.status_label.configure(text="Status: Listening...")
            phrase = take_command(lambda x: None, timeout=5, phrase_time_limit=5, ambient_duration=0.2)
            if not phrase:
                continue
            if any(wake_word in phrase for wake_word in WAKE_WORDS):
                self.status_label.configure(text="Status: ACTIVE", text_color="#00ff00")
                self.log("Wake word detected. Awaiting command.")
                speak("I'm listening.", block=False)   
                command = take_command(self.log, timeout=10, phrase_time_limit=25, ambient_duration=0.5)    
                if command:
                    self.process_command(command)
                else:
                    self.log("Command timeout.")
            time.sleep(0.1)

    def start_system(self):
        if self.listening:
            return
        self.listening = True
        self.start_btn.configure(state="disabled")
        threading.Thread(target=self.passive_listening_loop, daemon=True).start()

    def stop_system(self):
        self.listening = False
        self.status_label.configure(text="Status: STANDBY", text_color="#FFcc00")
        self.start_btn.configure(state="normal")
        self.log("System placed in standby mode.")

    def manual_input(self, event=None):
        cmd = self.manual_entry.get().strip()
        if cmd:
            self.log(f"User (Typed): {cmd}")
            self.manual_entry.delete(0, 'end')
            threading.Thread(target=self.process_command, args=(cmd,), daemon=True).start()
    
    def change_local_model(self, selected_model):
        APP_CONFIG["local_model"] = selected_model
        self.log(f"System Configuration: Local processing shifted to '{selected_model}'.")

    def change_cloud_model(self, selected_model):
        APP_CONFIG["cloud_model"] = selected_model
        self.log(f"System Configuration: Cloud fallback shifted to '{selected_model}'.")
    
    def on_close(self):
        self.listening = False
        self.destroy()
        sys.exit(0)

if __name__ == "__main__":
    app = VedaApp()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.log("System initialized. Supervisor AI routing active.")
    speak("Vedas AI system is online.")
    app.mainloop()

    #katam