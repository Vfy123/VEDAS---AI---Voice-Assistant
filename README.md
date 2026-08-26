# ⚡ VEDAS AI — Autonomous Multimodal Intelligence Operating System

<div align="center">

![Python Version](https://img.shields.io/badge/python-3.10%2B-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=for-the-badge&logo=fastapi)
![Ollama](https://img.shields.io/badge/Ollama-Local_Inference-white?style=for-the-badge&logo=ollama)
![Gemini](https://img.shields.io/badge/Google_Gemini-Supervisor_%26_Fallback-8E75B2?style=for-the-badge&logo=google)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Security](https://img.shields.io/badge/HTTPS-TLS_Encrypted-brightgreen?style=for-the-badge)

<p align="center">
  <strong>An advanced, cyber-glassmorphism AI workstation powered primarily by Local Ollama cores with Google Gemini Cloud supervisor fact-checking, multimodal PDF extraction, FLUX neural art synthesis, and two-stage voice conversation flow.</strong>
</p>

</div>

---

## 🏛️ System Architecture

```mermaid
graph TD
    User([👤 User / Browser Client]) <-->|HTTPS / WebSockets| UI[🎨 Cyber-Glassmorphism UI & Canvas]
    UI <-->|REST API / Audio Streams| Backend[🚀 FastAPI Server - vedas_server.py]
    
    subgraph Intelligence Hub
        Backend -->|1. Primary Inference (Default)| Ollama[⚡ Local Ollama Engine\nllama3.2 / llama3]
        Backend -->|2. Supervisor Fact-Check| GeminiSupervisor[🛡️ Gemini 3.6 Flash\nSilent Fact-Checker]
        Backend -->|3. Multimodal & Vision Fallback| GeminiCloud[☁️ Gemini Cloud Fallback]
    end
    
    subgraph Multi-Tool Subsystems
        Backend --> PDFEngine[📄 PDF Document Reader - pypdf]
        Backend --> ArtStudio[🎨 FLUX.1 Neural Image Studio]
        Backend --> CodeSandbox[💻 Python Sandbox Executor]
        Backend --> MemoryCore[(🧠 Long-Term Memory Bank)]
    end
```

---

## ✨ Core Features

### ⚡ 1. Dual-Core Intelligence (Ollama Major + Gemini Supervisor)
- **Local First**: All everyday reasoning and conversations run locally and privately on your machine via **Ollama** (`llama3.2:latest`, `llama3:latest`).
- **Silent Background Supervisor**: **Gemini 3.6 Flash** reviews Ollama's answers in real-time. If a factual inaccuracy is detected, a supervisor correction badge is displayed in the UI and spoken via voice output.
- **Automated Fallback**: Seamlessly switches to Gemini Cloud if Ollama is offline or times out.

### 📄 2. Document & PDF Vision Ingestion
- Ingest and analyze multi-page `.pdf` documents with automated text parsing, structured tables, and page-by-page comprehension.
- Ask questions, extract key metrics, compare data, and generate executive summaries directly from uploaded PDFs.

### 🎨 3. FLUX.1 Neural Art Studio
- Built-in studio for generating 8K ultra-detailed artwork across presets: *Cinematic 8K, Cyberpunk 2077, Makoto Shinkai Anime, Photorealistic, 3D Pixar, Fantasy Concept, Oil Painting, Pixel Art*.
- Support for multiple aspect ratios (`1:1`, `16:9`, `9:16`, `4:3`, `3:2`) and one-click image downloads.

### 🎙️ 4. Advanced Voice Engine & Two-Stage TTS
- **Global Hotkey**: Press **`Ctrl + M`** or **`Alt + V`** to activate/deactivate the microphone instantly.
- **Smart Conversation Flow**: Say *"Hello Vedas"* on the first turn. For subsequent conversation turns, Vedas automatically listens for 10 seconds right after answering — **no need to repeat the wake-word!**
- **Two-Stage TTS Confirmation**: For long answers, Vedas reads the introductory summary, then pauses and asks: *"Should I read it to you in full?"* Say *"Yes"* or click the corner button to hear the full text.

### 📐 5. LaTeX & Chemistry/Math Typography
- Automatic transformation of LaTeX formulas and chemical equations (e.g. `\text{Na}_2\text{S}`, `\mathrm{MgCl}_2`, `\text{Mg}^{2+}`) into clean, readable math typography.

### 💻 6. Python Code Execution Sandbox
- Run, test, and debug Python code blocks directly within the chat interface with live standard output and execution time metrics.

---

## 📂 Repository Structure

```
.
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules for security and clean clones
├── LICENSE                   # MIT License
├── README.md                 # Project documentation
├── requirements.txt          # Pinned Python dependencies
├── run_vedas_web.py          # Master launcher script
├── Vedas Linux Run.sh        # Linux launch executable
├── Vedas Windows Run.bat     # Windows batch launcher
├── Vedas Windows Run.ps1     # Windows PowerShell launcher
├── Vedas Mac Run.command     # macOS double-clickable launcher
└── Vedas AI Web Group/
    ├── SERVER/
    │   ├── vedas_server.py   # Core FastAPI Backend Server
    │   └── run_vedas_web.py  # Local server runner
    ├── RUN FILES/            # Cross-platform launcher scripts
    ├── certs/                # HTTPS SSL Certificates (auto-generated)
    ├── uploads/              # Ingested documents & PDFs
    ├── memory.json           # Long-term knowledge bank
    └── static/
        ├── index.html        # Futuristic Workspace UI
        ├── css/style.css     # Cyber-Glassmorphism Design System
        └── js/
            ├── app.js        # Client controller & TTS Engine
            ├── waveform.js   # Audio visualizer
            └── particles.js  # Neural matrix background canvas
```

---

## 🚀 Quickstart & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/vedas-ai.git
cd vedas-ai
```

### 2. Set Up Virtual Environment & Dependencies
```bash
python3 -m venv myvenv
source myvenv/bin/activate   # On Windows: myvenv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and configure your API keys:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_HOST=http://localhost:11434
LOCAL_MODEL=llama3.2:latest
CLOUD_MODEL=gemini-3.6-flash
SUPERVISOR_ENABLED=true
```

### 4. Ensure Ollama is Installed & Running (Optional for Local Models)
Install Ollama from [ollama.ai](https://ollama.ai) and pull your preferred model:
```bash
ollama pull llama3.2
```

---

## ⚡ Running the Application

### 🐧 Linux
```bash
./"Vedas Linux Run.sh"
```
*(or `python3 run_vedas_web.py`)*

### 🪟 Windows
Double-click:
```bat
"Vedas Windows Run.bat"
```
*(or execute `.\Vedas Windows Run.ps1` in PowerShell)*

### 🍎 macOS
Double-click:
```bash
"Vedas Mac Run.command"
```

The browser will automatically open at:
👉 **`https://127.0.0.1:8000`** *(or `https://localhost:8000`)*

> [!NOTE]
> Because Vedas AI uses local self-signed SSL certificates for secure microphone and Web Speech API access, click **"Advanced" → "Proceed to 127.0.0.1 (unsafe)"** on your browser's first visit.

---

## 🔒 Security Best Practices

- **Zero Hardcoded Secrets**: All API tokens and sensitive credentials are read strictly from `.env` or system environment variables and are excluded from version control via `.gitignore`.
- **Upload Protection**: File uploads use strict sanitization (`os.path.basename`) and enforce a 50MB file size ceiling to prevent path traversal and disk exhaustion.
- **Sandbox Guardrails**: Python execution blocks destructive file system operations and enforces a strict 10-second timeout.
- **Dynamic TLS Generation**: SSL private keys are generated on-the-fly locally and never committed to Git.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
