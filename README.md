# 🧠 Vedas AI — Multi-Modal AI Workstation & Web Assistant

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

**Vedas AI** is an intelligent, multi-modal personal AI assistant and command center. It features both a local-first architecture powered by **Ollama** and cloud intelligence powered by **Google Gemini**, integrated with real-time web search, document parsing, system diagnostics, and voice interaction.

---

## ✨ Key Features

- **🌐 Hybrid AI Intelligence**: Seamlessly switch between local private LLMs (**Ollama**) and high-speed cloud intelligence (**Google Gemini API**).
- **🎙️ Voice & Audio Interaction**: Real-time speech recognition and text-to-speech audio feedback.
- **🔍 Live Web Intelligence**: Real-time internet searches and website summaries via DuckDuckGo and Wikipedia integrations.
- **📄 Multimodal Document & Vision Analysis**: Upload and analyze PDFs, images, and text files directly inside the workspace.
- **💻 Desktop System Automation**: System telemetry (CPU, RAM, battery), volume controls, app launchers, and automation.
- **🎨 Glassmorphic Web UI**: Modern, responsive dark-mode web console with real-time streaming, conversation history, and quick action widgets.
- **🔒 Secure Local Storage**: Retains notes, history, and uploaded files locally without external cloud lock-in.

---

## 🏗️ Project Architecture

```
Ai bro/
├── requirements.txt             # Python dependencies specification
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore patterns
├── README.md                    # Project documentation
├── LICENSE                      # Open-source MIT license
├── veda_ultra.py                # Standalone desktop voice assistant
├── build_exe.py                 # PyInstaller packaging script
└── Vedas AI Web Group/
    ├── SERVER/
    │   ├── vedas_server.py      # FastAPI backend server
    │   └── run_vedas_web.py     # Server and browser orchestrator
    ├── RUN FILES/               # Quick launcher scripts (Windows, Mac, Linux)
    ├── static/                  # Web dashboard UI (HTML, CSS, JS)
    ├── uploads/                 # Local uploaded documents/images
    └── memory/                  # Persistent memory storage (JSON)
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/vedas-ai.git
cd vedas-ai
```

### 2. Set Up a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and provide your Gemini API key:
```bash
cp .env.example .env
```
Open `.env` in any text editor:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
HOST=127.0.0.1
PORT=8000
```

### 5. Launch Vedas AI

#### Option A: Quick Launchers (Recommended)
- **Windows**: Double-click `Vedas AI Web Group/RUN FILES/Vedas Windows Run.bat`
- **Linux**: Execute `bash "Vedas AI Web Group/RUN FILES/Vedas Linux Run.sh"`
- **macOS**: Execute `"Vedas AI Web Group/RUN FILES/Vedas Mac Run.command"`

#### Option B: Terminal Command
```bash
python "Vedas AI Web Group/SERVER/run_vedas_web.py"
```

Then visit [https://127.0.0.1:8000](https://127.0.0.1:8000) (or `http://127.0.0.1:8000`) in your web browser.

---

## 📦 Optional: Local LLM Setup (Ollama)

For offline, 100% private AI inference:
1. Download and install [Ollama](https://ollama.com/).
2. Pull your preferred model (e.g. Llama 3, Mistral, Qwen):
   ```bash
   ollama run llama3
   ```
3. Vedas AI will automatically detect running Ollama instances on `http://127.0.0.1:11434`.

---

## 🛠️ Requirements & Tech Stack

- **Python**: 3.10 or newer
- **Backend**: FastAPI, Uvicorn, Pydantic, WebSockets
- **AI / LLM**: `google-genai`, `ollama`
- **Voice / Audio**: `SpeechRecognition`, `pyttsx3`, `PyAudio`, `faster-whisper`
- **Utilities**: `duckduckgo-search`, `wikipedia`, `pypdf`, `Pillow`, `psutil`, `pyautogui`

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/your-username/vedas-ai/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.
