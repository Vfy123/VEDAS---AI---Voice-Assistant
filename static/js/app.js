/**
 * Vedas AI — Master Web Application Client (Production Edition)
 * Multimodal Chat, PDF Ingestion, Neural Image Studio, Smart Voice Flow with Wake-Words, Hotkeys,
 * LaTeX & Math Typography, and Advanced Two-Stage TTS Engine ("Read in Full" confirmation).
 */

// Application State
const state = {
  currentSessionId: null,
  sessions: [],
  memoryNotes: [],
  attachments: [],
  useWebSearch: false,
  isListening: false,
  inConversationMode: false,
  conversationTimeoutId: null,
  speechSynthEnabled: true,
  currentPersona: 'master_vedas',
  activeModel: 'llama3.2:latest',
  systemStatus: {},
  isSpeaking: false,
  micArmed: false,
  recognitionActive: false,
  // Friendly display names for known models
  modelDisplayNames: {
    'llama3.2:latest': 'LLaMA 3.2 (Primary)',
    'llama3.2:1b': 'LLaMA 3.2 1B (Fast)',
    'llama3.2': 'LLaMA 3.2',
    'llama3:latest': 'LLaMA 3',
    'llama3': 'LLaMA 3',
    'qwen2.5:7b': 'Qwen 2.5 7B',
    'phi4:latest': 'Phi-4',
    'gemini-3.7-flash': 'Gemini 3.7 Flash',
    'gemini-3.6-flash': 'Gemini 3.6 Flash',
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
    'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro'
  },
  // TTS State
  currentTTS: {
    fullText: '',
    remainingText: '',
    isPausedForConfirmation: false
  }
};

// DOM References
const chatMessagesContainer = document.getElementById('chat-messages-container');
const welcomeHero = document.getElementById('welcome-hero');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const fileInput = document.getElementById('file-input');
const attachmentTray = document.getElementById('attachment-tray');
const sessionsList = document.getElementById('sessions-list');
const memoryList = document.getElementById('memory-list');
const sideCanvas = document.getElementById('side-canvas');
const sideCanvasTitle = document.getElementById('side-canvas-title');
const sideCanvasBody = document.getElementById('side-canvas-body');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const modelSelector = document.getElementById('model-selector');
const personaSelector = document.getElementById('persona-selector');
const webSearchBtn = document.getElementById('web-search-toggle');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------- LATEX & MATH FORMATTING HELPER -----------------
function formatLaTeXMath(str) {
  if (!str) return '';

  let res = str;

  // Clean LaTeX text & font tags
  res = res.replace(/\\text\{([^}]+)\}/g, '$1');
  res = res.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  res = res.replace(/\\mathbf\{([^}]+)\}/g, '<strong>$1</strong>');
  res = res.replace(/\\mathit\{([^}]+)\}/g, '<em>$1</em>');
  res = res.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');

  // Spacing & Symbols
  res = res.replace(/\\quad|\\qquad|\\,|\\;|\\!/g, ' ');
  res = res.replace(/\\times/g, '×');
  res = res.replace(/\\pm/g, '±');
  res = res.replace(/\\approx/g, '≈');
  res = res.replace(/\\neq|\\ne/g, '≠');
  res = res.replace(/\\leq|\\le/g, '≤');
  res = res.replace(/\\geq|\\ge/g, '≥');
  res = res.replace(/\\implies|\\rightarrow|\\to/g, ' → ');
  res = res.replace(/\\leftarrow/g, ' ← ');
  res = res.replace(/\\degree|\\circ/g, '°');

  // Fractions: \frac{a}{b} -> (a / b)
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');

  // Superscripts & Subscripts in Math: ^{2+} -> <sup>2+</sup>, _{2} -> <sub>2</sub>
  res = res.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  res = res.replace(/\^([0-9a-zA-Z+-]+)/g, '<sup>$1</sup>');
  res = res.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  res = res.replace(/_([0-9a-zA-Z+-]+)/g, '<sub>$1</sub>');

  // Strip remaining solitary backslashes
  res = res.replace(/\\([a-zA-Z]+)/g, '$1');

  return res;
}

// ----------------- MARKDOWN PARSER -----------------
function renderMarkdown(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Collapsible Thinking / Analytical Pass
  escaped = escaped.replace(/&lt;details&gt;\s*&lt;summary&gt;(.*?)&lt;\/summary&gt;([\s\S]*?)&lt;\/details&gt;/gi, (m, summary, body) => {
    return `<details class="thinking-pass"><summary>${summary}</summary><div class="thinking-content">${body.trim()}</div></details>`;
  });

  // Code blocks with language tags
  escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'code';
    const rawCode = code.trim();
    const encodedCode = encodeURIComponent(rawCode);
    const runButtonHtml = (language.toLowerCase() === 'python' || language.toLowerCase() === 'py')
      ? `<button class="code-action-btn" onclick="executePythonSandbox('${encodedCode}', this)">▶ Run Code</button>`
      : '';

    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${language.toUpperCase()}</span>
          <div style="display:flex; gap:6px;">
            ${runButtonHtml}
            <button class="code-action-btn" onclick="copyCodeSnippet('${encodedCode}', this)">📋 Copy</button>
          </div>
        </div>
        <pre><code class="language-${language}">${rawCode}</code></pre>
        <div class="code-output-box" style="display:none; padding:10px 14px; background:#06080d; border-top:1px solid #1f293d; font-family:var(--font-mono); font-size:0.8rem; color:#10b981;"></div>
      </div>
    `;
  });

  // Display Math: $$ ... $$
  escaped = escaped.replace(/\$\$([\s\S]*?)\$\$/g, (m, mathContent) => {
    return `<div class="math-block" style="background:rgba(0, 240, 255, 0.05); border:1px solid rgba(0, 240, 255, 0.2); border-radius:6px; padding:8px 12px; margin:8px 0; font-family:var(--font-mono); font-size:0.95rem; color:#00f0ff;">${formatLaTeXMath(mathContent)}</div>`;
  });

  // Inline Math: $ ... $
  escaped = escaped.replace(/\$([^\$\n]+)\$/g, (m, mathContent) => {
    return `<span class="math-inline" style="background:rgba(0, 240, 255, 0.08); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); color:#00f0ff;">${formatLaTeXMath(mathContent)}</span>`;
  });

  // Apply general LaTeX cleanup for any unescaped formulas
  escaped = formatLaTeXMath(escaped);

  // Inline code
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold & Italic
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers
  escaped = escaped.replace(/^### (.*$)/gim, '<h3 style="color:#00f0ff; margin:12px 0 6px 0; font-size:1.1rem;">$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2 style="color:#ffffff; margin:14px 0 8px 0; font-size:1.25rem;">$1</h2>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h1 style="color:#00f0ff; margin:16px 0 10px 0; font-size:1.4rem;">$1</h1>');

  // Bullet Lists
  escaped = escaped.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  escaped = escaped.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Line breaks
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}

// ----------------- TOAST NOTIFICATIONS (Clean Single-Toast Queue) -----------------
let currentToastTimeout = null;
function showToast(message, icon = '✨') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  container.innerHTML = '';
  clearTimeout(currentToastTimeout);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  currentToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

// ----------------- TELEMETRY & SYSTEM STATUS -----------------
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/system/status');
    if (!res.ok) return;
    const data = await res.json();
    state.systemStatus = data;

    // Update Status HUD
    const cpuEl = document.getElementById('hud-cpu');
    const ramEl = document.getElementById('hud-ram');
    const ollamaDot = document.getElementById('hud-ollama-dot');
    const ollamaText = document.getElementById('hud-ollama-text');

    if (cpuEl) cpuEl.textContent = `CPU: ${data.cpu_usage}%`;
    if (ramEl) ramEl.textContent = `RAM: ${data.ram_usage}%`;
    if (ollamaDot && ollamaText) {
      if (data.ollama_running) {
        ollamaDot.className = 'status-dot';
        ollamaText.textContent = `⚡ OLLAMA: ${data.active_local_model}`;
      } else {
        ollamaDot.className = 'status-dot danger';
        ollamaText.textContent = '⚡ OLLAMA: OFFLINE';
      }
    }

    // Populate model options with thunderbolt in front of EVERY option.
    // Avoid rebuilding DOM if option list has not changed, preserving user selection.
    if (modelSelector && data.local_models) {
      const geminiList = (data.cloud_models && data.cloud_models.length)
        ? data.cloud_models
        : [
            { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
            { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
            { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
            { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
            { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' }
          ];

      const currentValues = Array.from(modelSelector.options).map(o => o.value).join('|');
      const newValues = [...data.local_models, ...geminiList.map(m => m.id || m)].join('|');

      if (currentValues !== newValues || modelSelector.options.length === 0) {
        const previousSelection = state.activeModel || modelSelector.value;
        modelSelector.innerHTML = '';

        const localGroup = document.createElement('optgroup');
        localGroup.label = '⚡ Local Ollama Models (Primary)';
        data.local_models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          const name = state.modelDisplayNames[m] || m;
          opt.textContent = `⚡ Local: ${name}`;
          localGroup.appendChild(opt);
        });
        modelSelector.appendChild(localGroup);

        const cloudGroup = document.createElement('optgroup');
        cloudGroup.label = '⚡ Gemini Cloud Models (Supervisor & Fallback)';
        geminiList.forEach(m => {
          const opt = document.createElement('option');
          const mId = m.id || m;
          opt.value = mId;
          const name = m.name || state.modelDisplayNames[mId] || mId;
          opt.textContent = `⚡ Cloud: ${name}`;
          cloudGroup.appendChild(opt);
        });
        modelSelector.appendChild(cloudGroup);

        // Restore selection to the previous user selection or primary local model
        const target = Array.from(modelSelector.options).find(o => o.value === previousSelection) ||
                       Array.from(modelSelector.options).find(o => o.value === data.active_local_model) ||
                       modelSelector.options[0];
        if (target) {
          target.selected = true;
          state.activeModel = target.value;
        }
      }
    }
  } catch (err) {
    console.error('Telemetry Error:', err);
  }
}

window.restartOllamaService = async function () {
  const ollamaDot = document.getElementById('hud-ollama-dot');
  const ollamaText = document.getElementById('hud-ollama-text');
  if (ollamaDot) ollamaDot.className = 'status-dot inferring';
  if (ollamaText) ollamaText.textContent = '⚡ OLLAMA: CONNECTING...';
  showToast('Connecting to Ollama background core...', '⚡');
  try {
    const res = await fetch('/api/ollama/start', { method: 'POST' });
    const data = await res.json();
    if (data.running) {
      showToast('Ollama Core Connected and Ready!', '⚡');
    } else {
      showToast('Ollama not running. Try: ollama serve', '⚠️');
    }
    await fetchSystemStatus();
  } catch (err) {
    showToast('Ollama connection request failed', '❌');
    await fetchSystemStatus();
  }
};

// ----------------- SESSIONS & MEMORY -----------------
async function loadSessionsAndMemory() {
  try {
    const res = await fetch('/api/memory');
    if (!res.ok) return;
    const data = await res.json();
    state.sessions = data.sessions || [];
    state.memoryNotes = data.notes || [];

    renderSidebarSessions();
    renderSidebarMemory();

    if (state.sessions.length > 0 && !state.currentSessionId) {
      loadSession(state.sessions[0].id);
    }
  } catch (err) {
    console.error('Load Memory Error:', err);
  }
}

function renderSidebarSessions() {
  if (!sessionsList) return;
  sessionsList.innerHTML = '';
  if (state.sessions.length === 0) {
    sessionsList.innerHTML = '<div style="color:var(--text-dim); font-size:0.8rem; padding:8px;">No recent sessions.</div>';
    return;
  }

  state.sessions.forEach(sess => {
    const item = document.createElement('div');
    item.className = `session-item ${sess.id === state.currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="session-title">💬 ${sess.title || 'New Conversation'}</span>
      <button class="session-del-btn" title="Delete Session" onclick="deleteSession('${sess.id}', event)">✕</button>
    `;
    item.onclick = () => loadSession(sess.id);
    sessionsList.appendChild(item);
  });
}

function renderSidebarMemory() {
  if (!memoryList) return;
  memoryList.innerHTML = '';
  if (state.memoryNotes.length === 0) {
    memoryList.innerHTML = `
      <div class="sidebar-empty-state">
        <span class="sidebar-empty-icon">🧠</span>
        <div class="sidebar-empty-title">Memory Bank Empty</div>
        <div class="sidebar-empty-hint">Say "remember [fact]" or add via Memory Core button above.</div>
      </div>
    `;
    return;
  }

  state.memoryNotes.forEach((note, idx) => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.title = note;
    item.innerHTML = `
      <span class="session-title" style="max-width:180px;">📌 ${escapeHtml(note)}</span>
      <button class="session-del-btn" title="Forget Note" onclick="deleteMemoryNote(${idx}, event)">✕</button>
    `;
    memoryList.appendChild(item);
  });
}

function startNewChat() {
  state.currentSessionId = String(Date.now());
  state.inConversationMode = false;
  const newSession = {
    id: state.currentSessionId,
    title: 'New Conversation',
    messages: []
  };
  state.sessions.unshift(newSession);
  renderSidebarSessions();
  renderChatMessages([]);
  showToast('New Conversation', '🚀');
}

function loadSession(sessionId) {
  state.currentSessionId = sessionId;
  state.inConversationMode = false;
  renderSidebarSessions();
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    renderChatMessages(session.messages || []);
  }
}

async function deleteSession(sessionId, event) {
  event.stopPropagation();
  try {
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    state.sessions = state.sessions.filter(s => s.id !== sessionId);
    if (state.currentSessionId === sessionId) {
      if (state.sessions.length > 0) {
        loadSession(state.sessions[0].id);
      } else {
        startNewChat();
      }
    } else {
      renderSidebarSessions();
    }
    showToast('Session Deleted', '🗑️');
  } catch (err) {
    console.error('Delete Session Error:', err);
  }
}

async function deleteMemoryNote(index, event) {
  if (event) event.stopPropagation();
  try {
    const res = await fetch(`/api/memory/notes/${index}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      state.memoryNotes = data.notes || [];
      renderSidebarMemory();
      renderFullMemoryList();
      showToast('Memory Note Removed', '🧠');
    }
  } catch (err) {
    console.error('Delete Memory Note Error:', err);
  }
}

// ----------------- CHAT RENDERING -----------------
function renderChatMessages(messages) {
  if (!chatMessagesContainer) return;
  chatMessagesContainer.innerHTML = '';

  if (!messages || messages.length === 0) {
    if (welcomeHero) welcomeHero.style.display = 'flex';
    if (chatMessagesContainer) chatMessagesContainer.style.display = 'none';
    return;
  }

  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) chatMessagesContainer.style.display = 'flex';

  messages.forEach(msg => {
    appendMessageToDOM(msg.role, msg.content, msg.meta, false);
  });

  scrollChatToBottom();
}

function appendMessageToDOM(role, content, meta = {}, shouldScroll = true) {
  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) chatMessagesContainer.style.display = 'flex';

  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user' : 'ai'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar-badge';
  avatar.innerHTML = role === 'user' ? '👤' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Attachments display for user messages
  let attachmentsHtml = '';
  if (meta && meta.attachments && meta.attachments.length > 0) {
    attachmentsHtml = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">';
    meta.attachments.forEach(att => {
      if (att.data && att.type && att.type.includes('image')) {
        attachmentsHtml += `<img src="${att.data}" style="max-height:160px; border-radius:8px; border:1px solid rgba(0,240,255,0.3); cursor:pointer;" onclick="openLightbox('${att.data}')" />`;
      } else if (att.is_pdf || (att.name && att.name.endsWith('.pdf'))) {
        attachmentsHtml += `<div class="attachment-chip" style="background:rgba(239, 68, 68, 0.15); border-color:#ef4444; color:#fca5a5;">📕 ${att.name} ${att.page_count ? `(${att.page_count} pages)` : ''}</div>`;
      } else {
        attachmentsHtml += `<div class="attachment-chip">📄 ${att.name}</div>`;
      }
    });
    attachmentsHtml += '</div>';
  }

  // Meta indicators for AI messages
  let metaHtml = '';
  let ttsControlsHtml = '';
  if (role === 'ai') {
    const isOllama = meta && meta.source === 'ollama';
    const modelDisplayName = meta && meta.model ? (state.modelDisplayNames[meta.model] || meta.model) : (isOllama ? 'Local Ollama' : 'Gemini Cloud');
    const modelTag = modelDisplayName;
    metaHtml = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div class="ai-meta-tag" style="margin-bottom:0;">⚡ ${isOllama ? 'Local Ollama' : 'Gemini Cloud'}: ${modelTag}</div>
        <div style="display:flex; gap:6px;">
          <button class="tts-bubble-btn" title="Read message aloud" onclick="speakMessageManual(this)">🔊 Read</button>
          <button class="tts-bubble-btn" title="Stop speech" onclick="stopSpeech()">⏹ Stop</button>
        </div>
      </div>
    `;

    if (meta && meta.supervisorAlert) {
      metaHtml += `<div class="supervisor-alert-badge">🛡️ Supervisor AI Correction: ${meta.supervisorAlert}</div>`;
    }
  }

  // Image Generation Card
  let imageCardHtml = '';
  if (meta && meta.generatedImage) {
    const imgData = meta.generatedImage;
    imageCardHtml = `
      <div class="generated-image-card">
        <img src="${imgData.data_uri || imgData.url}" alt="AI Generated" onclick="openLightbox('${imgData.data_uri || imgData.url}')" />
        <div class="img-overlay-tools">
          <span class="img-tag-info">🎨 ${imgData.style.toUpperCase()} • ${imgData.width}x${imgData.height}</span>
          <button class="img-btn" onclick="downloadImage('${imgData.data_uri || imgData.url}', 'vedas_art_${Date.now()}.jpg')">⬇ Download</button>
        </div>
      </div>
    `;
  }

  bubble.innerHTML = `${metaHtml}${attachmentsHtml}${renderMarkdown(content)}${imageCardHtml}`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessagesContainer.appendChild(row);

  if (shouldScroll) {
    scrollChatToBottom();
  }
}

function appendAnimatedMessageToDOM(role, content, meta = {}, onComplete = null) {
  if (role !== 'ai' || !content) {
    appendMessageToDOM(role, content, meta, true);
    if (onComplete) onComplete();
    return;
  }

  if (welcomeHero) welcomeHero.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'message-row ai';

  const avatar = document.createElement('div');
  avatar.className = 'avatar-badge animated-avatar';
  avatar.innerHTML = '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const isOllama = meta && meta.source === 'ollama';
  const modelDisplayName = meta && meta.model ? (state.modelDisplayNames[meta.model] || meta.model) : (isOllama ? 'Local Ollama' : 'Gemini Cloud');
  const modelTag = modelDisplayName;
  const badgeClass = isOllama ? 'ai-meta-tag ollama-active-badge' : 'ai-meta-tag';

  const metaDiv = document.createElement('div');
  metaDiv.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <div class="${badgeClass}" style="margin-bottom:0;">⚡ ${isOllama ? 'Local Ollama' : 'Gemini Cloud'}: ${modelTag}</div>
      <div style="display:flex; gap:6px;">
        <button class="tts-bubble-btn" title="Read message aloud" onclick="speakMessageManual(this)">🔊 Read</button>
        <button class="tts-bubble-btn" title="Stop speech" onclick="stopSpeech()">⏹ Stop</button>
      </div>
    </div>
    ${meta && meta.supervisorAlert ? `<div class="supervisor-alert-badge">🛡️ Supervisor AI Correction: ${meta.supervisorAlert}</div>` : ''}
  `;

  const textContainer = document.createElement('div');
  textContainer.className = 'ai-text-stream';

  bubble.appendChild(metaDiv);
  bubble.appendChild(textContainer);
  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessagesContainer.appendChild(row);
  scrollChatToBottom();

  // Fast typewriter animated stream
  const tokens = content.split(/(\s+)/);
  let accumulated = '';
  let tokenIdx = 0;
  const chunk = 3;
  const speedMs = 15;

  const timer = setInterval(() => {
    if (tokenIdx < tokens.length) {
      accumulated += tokens.slice(tokenIdx, tokenIdx + chunk).join('');
      tokenIdx += chunk;
      textContainer.innerHTML = renderMarkdown(accumulated) + '<span class="typing-cursor">█</span>';
      scrollChatToBottom();
    } else {
      clearInterval(timer);
      textContainer.innerHTML = renderMarkdown(content);
      scrollChatToBottom();
      if (onComplete) onComplete();
    }
  }, speedMs);
}

function scrollChatToBottom() {
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
}

// ----------------- SEND MESSAGE HANDLER -----------------
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text && state.attachments.length === 0) return;
  if (state.micArmed || state.isListening) hardStopMic();

  if (!state.currentSessionId) {
    state.currentSessionId = String(Date.now());
    state.sessions.unshift({
      id: state.currentSessionId,
      title: text ? (text.length > 35 ? text.substring(0, 32) + '...' : text) : 'Attachment Query',
      messages: []
    });
    renderSidebarSessions();
  }

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
  const userAttachments = [...state.attachments];

  // Auto-rename "New Conversation" to actual prompt title
  if (currentSession && currentSession.title === 'New Conversation' && text) {
    currentSession.title = text.length > 35 ? text.substring(0, 32) + '...' : text;
    renderSidebarSessions();
  }

  // Append user message
  const userMsg = {
    role: 'user',
    content: text,
    meta: { attachments: userAttachments }
  };
  if (currentSession) currentSession.messages.push(userMsg);
  appendMessageToDOM('user', text, { attachments: userAttachments });

  // Reset input & attachments
  chatInput.value = '';
  state.attachments = [];
  renderAttachmentTray();
  autoResizeChatInput();

  if (text && /^(shutdown|shut down|power off)\b/i.test(text)) {
    confirmShutdown();
    if (window.vedasWaveform) window.vedasWaveform.setState('idle');
    if (window.setHologramState) setHologramState('idle');
    return;
  }

  if (text && /^(restart|reboot)\b/i.test(text)) {
    confirmRestart();
    if (window.vedasWaveform) window.vedasWaveform.setState('idle');
    if (window.setHologramState) setHologramState('idle');
    return;
  }

  // Check for image generation prompt prefix
  const imageGenMatch = text.match(/^(?:\/image|generate image(?: of)?|create an image of)\s+(.+)/i);
  if (imageGenMatch && userAttachments.length === 0) {
    const promptForImg = imageGenMatch[1];
    showToast('Synthesizing Neural Art with FLUX...', '🎨');
    try {
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptForImg,
          style: 'cinematic',
          aspect_ratio: '1:1',
          enhance_prompt: true
        })
      });
      const imgData = await imgRes.json();
      const aiReply = {
        role: 'ai',
        content: `I have created the artwork for: **"${promptForImg}"**`,
        meta: {
          generatedImage: imgData,
          model: 'FLUX.1-Neural',
          source: 'image_gen'
        }
      };
      if (currentSession) currentSession.messages.push(aiReply);
      appendMessageToDOM('ai', aiReply.content, aiReply.meta);
      saveCurrentSessionToBackend();
      smartSpeakResponse(`Here is the image for ${promptForImg}`);
    } catch (err) {
      console.error('Image Generation Error:', err);
      appendMessageToDOM('ai', `⚠️ Image generation encountered an error: ${err.message}`);
    } finally {
      if (window.vedasWaveform) window.vedasWaveform.setState('idle');
    }
    return;
  }

  // Check for system commands (open notepad, shutdown, etc.)
  if (text && checkVoiceSystemCommand(text)) {
    try {
      const cmdRes = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text })
      });
      const cmdData = await cmdRes.json();
      if (cmdData.success) {
        const aiMsg = { role: 'ai', content: `⚡ **System Command Executed:** ${cmdData.message}`, meta: { model: 'system', source: 'system_action' } };
        if (currentSession) currentSession.messages.push(aiMsg);
        appendMessageToDOM('ai', aiMsg.content, aiMsg.meta);
        saveCurrentSessionToBackend();
        if (state.speechSynthEnabled) smartSpeakResponse(cmdData.message);
        if (window.vedasWaveform) window.vedasWaveform.setState('idle');
        return;
      }
    } catch (e) { /* fallthrough to AI */ }
  }

  // Set UI into thinking animation state
  if (window.vedasWaveform) window.vedasWaveform.setState('thinking');
  if (window.setHologramState) setHologramState('ai_thinking');

  const ollamaDot = document.getElementById('hud-ollama-dot');
  const ollamaText = document.getElementById('hud-ollama-text');
  if (ollamaDot) ollamaDot.className = 'status-dot inferring';
  if (ollamaText) ollamaText.textContent = '⚡ OLLAMA: GENERATING...';

  // Append animated thinking indicator card in the chat
  const thinkingRow = document.createElement('div');
  thinkingRow.className = 'message-row ai thinking-row';
  thinkingRow.id = 'active-thinking-indicator';
  const isCloudActive = state.activeModel && state.activeModel.includes('gemini');
  const activeName = state.modelDisplayNames[state.activeModel] || state.activeModel;
  const activeLabel = isCloudActive ? `Gemini Cloud: ${activeName}` : `Local Ollama: ${activeName}`;
  thinkingRow.innerHTML = `
    <div class="avatar-badge animated-avatar">⚡</div>
    <div class="message-bubble thinking-bubble">
      <div class="ai-meta-tag ${isCloudActive ? '' : 'ollama-active-badge'}">⚡ ${activeLabel}</div>
      <div class="thinking-pulse-wrapper">
        <div class="thinking-spinner"></div>
        <div class="thinking-details">
          <span class="thinking-label">Synthesizing intelligence</span>
          <span class="thinking-dots-anim"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    </div>
  `;
  chatMessagesContainer.appendChild(thinkingRow);
  scrollChatToBottom();

  // Send standard / multimodal chat request to backend
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text || 'Please inspect the attached documents and provide your analysis.',
        session_id: state.currentSessionId,
        persona: state.currentPersona,
        model_override: state.activeModel,
        use_web_search: state.useWebSearch,
        enable_thinking: false,
        attachments: userAttachments
      })
    });

    // Remove thinking indicator
    const existingThinking = document.getElementById('active-thinking-indicator');
    if (existingThinking) existingThinking.remove();

    if (!res.ok) {
      let backendDetail = '';
      try {
        const errBody = await res.json();
        backendDetail = errBody.detail || errBody.message || errBody.error || '';
      } catch (_) { /* ignore parse error */ }
      throw new Error(`HTTP Error ${res.status}${backendDetail ? `: ${backendDetail}` : ''}`);
    }

    const data = await res.json();
    const aiMsg = {
      role: 'ai',
      content: data.text || 'No response received.',
      meta: {
        model: data.model,
        source: data.source,
        supervisorAlert: data.supervisor_alert
      }
    };

    // Show a friendly, actionable hint if the response is an error/offline source
    if (data.source === 'error' || data.source === 'offline') {
      const hint = data.text && data.text.includes('Ollama')
        ? '\n\n💡 Tip: Make sure the AI core (Ollama) is running, or select a different model in the top-left dropdown. If you picked Qwen 2.5 or Phi-4, first run: `ollama pull qwen2.5:7b` (or `ollama pull phi4`).'
        : '';
      aiMsg.content = (data.text || '') + hint;
    }

    if (currentSession) currentSession.messages.push(aiMsg);
    appendAnimatedMessageToDOM('ai', aiMsg.content, aiMsg.meta);
    saveCurrentSessionToBackend();

    // Voice response with two-stage confirmation TTS
    if (state.speechSynthEnabled && data.text) {
      smartSpeakResponse(data.text);
    }
  } catch (err) {
    const existingThinking = document.getElementById('active-thinking-indicator');
    if (existingThinking) existingThinking.remove();
    console.error('Chat Error:', err);
    appendMessageToDOM('ai', `⚠️ Neural Core Interruption: ${err.message}\n\nPlease verify that the backend server is running and try again. If the AI core won't respond, restart Vedas AI or check your internet connection for cloud models.`);
  } finally {
    // Restore HUD and animations safely
    const oDot = document.getElementById('hud-ollama-dot');
    const oText = document.getElementById('hud-ollama-text');
    if (oDot && oText && state.systemStatus) {
      if (state.systemStatus.ollama_running) {
        oDot.className = 'status-dot';
        oText.textContent = `⚡ OLLAMA: ${state.systemStatus.active_local_model || state.activeModel}`;
      } else {
        oDot.className = 'status-dot danger';
        oText.textContent = '⚡ OLLAMA: OFFLINE';
      }
    }
    if (window.vedasWaveform && !state.isListening && !state.isSpeaking) {
      window.vedasWaveform.setState('idle');
    }
    if (window.setHologramState && !state.isListening && !state.isSpeaking) {
      setHologramState('idle');
    }
  }
}

async function saveCurrentSessionToBackend() {
  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
  if (!currentSession) return;
  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSession)
    });
    renderSidebarSessions();
  } catch (err) {
    console.error('Save Session Error:', err);
  }
}

// ----------------- FILE UPLOADS & ATTACHMENTS (PDF & ALL) -----------------
function handleFileSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  processFiles(Array.from(files));
}

async function processFiles(fileList) {
  for (const file of fileList) {
    const formData = new FormData();
    formData.append('file', file);

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    showToast(`Ingesting ${file.name}...`, isPdf ? '📕' : '📎');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const uploaded = await res.json();
        state.attachments.push({
          name: uploaded.filename,
          type: uploaded.content_type,
          size: uploaded.size,
          is_pdf: uploaded.is_pdf,
          page_count: uploaded.page_count,
          data: uploaded.data,
          text_content: uploaded.text_content
        });
        renderAttachmentTray();
        showToast(`Ready: ${uploaded.filename}${uploaded.page_count ? ` (${uploaded.page_count} pages)` : ''}`, '✅');
      }
    } catch (err) {
      console.error('File Upload Error:', err);
      showToast(`Upload failed for ${file.name}`, '❌');
    }
  }
}

function renderAttachmentTray() {
  if (!attachmentTray) return;
  attachmentTray.innerHTML = '';
  state.attachments.forEach((att, idx) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    if (att.is_pdf || (att.name && att.name.endsWith('.pdf'))) {
      chip.style.borderColor = '#ef4444';
      chip.style.color = '#fca5a5';
      chip.innerHTML = `
        <span>📕 ${att.name} ${att.page_count ? `(${att.page_count}p)` : ''}</span>
        <button class="attachment-remove" onclick="removeAttachment(${idx})">✕</button>
      `;
    } else {
      const thumbHtml = att.data ? `<img src="${att.data}" class="attachment-thumb" />` : '📄';
      chip.innerHTML = `
        ${thumbHtml}
        <span>${att.name}</span>
        <button class="attachment-remove" onclick="removeAttachment(${idx})">✕</button>
      `;
    }
    attachmentTray.appendChild(chip);
  });
}

function removeAttachment(index) {
  state.attachments.splice(index, 1);
  renderAttachmentTray();
}

// ----------------- ADVANCED TWO-STAGE TEXT-TO-SPEECH ENGINE -----------------
function cleanTextForSpeech(raw) {
  if (!raw) return '';
  let clean = raw
    .replace(/<details[\s\S]*?<\/details>/gi, '')
    .replace(/```[\s\S]*?```/g, 'Code snippet provided.')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[$_^{}]/g, '')
    .replace(/[*#`~-]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/https?:\/\/\S+/g, 'link');

  return clean.replace(/\s+/g, ' ').trim();
}

function smartSpeakResponse(fullText) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const cleaned = cleanTextForSpeech(fullText);
  if (!cleaned) return;

  state.currentTTS.fullText = cleaned;
  state.currentTTS.remainingText = '';
  state.currentTTS.isPausedForConfirmation = false;

  // If text is short (<= 220 chars or 2 short sentences), speak it completely
  if (cleaned.length <= 220) {
    speakUtterance(cleaned, () => onSpeechFinished(false));
    return;
  }

  // Split into First Half / Introduction vs Remaining Half
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  let halfText = '';
  let remainingText = '';
  let charCount = 0;
  const targetChars = Math.min(240, Math.floor(cleaned.length / 2));

  for (let i = 0; i < sentences.length; i++) {
    if (charCount < targetChars || i === 0) {
      halfText += sentences[i] + ' ';
      charCount += sentences[i].length;
    } else {
      remainingText += sentences.slice(i).join(' ');
      break;
    }
  }

  if (!remainingText.trim()) {
    speakUtterance(cleaned, () => onSpeechFinished(false));
    return;
  }

  state.currentTTS.remainingText = remainingText.trim();
  state.currentTTS.isPausedForConfirmation = true;

  // Speak half text + Ask confirmation
  const firstPass = `${halfText.trim()} ... Should I read it to you in full?`;
  speakUtterance(firstPass, () => {
    // Show on-screen confirmation banner
    showTTSFullReadBanner();
    onSpeechFinished(true); // wait for voice confirmation or button click
  });
}

function speakUtterance(text, onEndCallback) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    state.isSpeaking = true;
    haltMicForSpeech();
    if (window.vedasWaveform) window.vedasWaveform.setState('speaking');
    setHologramState('ai_speaking');
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    if (window.vedasWaveform && !state.isListening) window.vedasWaveform.setState('idle');
    setHologramState('idle');
    if (onEndCallback) onEndCallback();
  };

  utterance.onerror = () => {
    state.isSpeaking = false;
    setHologramState('idle');
    if (window.vedasWaveform && !state.isListening) window.vedasWaveform.setState('idle');
  };

  window.speechSynthesis.speak(utterance);
}

function readFullResponse() {
  removeTTSFullReadBanner();
  if (state.currentTTS.remainingText) {
    const textToRead = state.currentTTS.remainingText;
    state.currentTTS.remainingText = '';
    state.currentTTS.isPausedForConfirmation = false;
    speakUtterance(textToRead, () => onSpeechFinished(false));
  } else if (state.currentTTS.fullText) {
    speakUtterance(state.currentTTS.fullText, () => onSpeechFinished(false));
  }
}

function stopSpeech() {
  state.isSpeaking = false;
  state.currentTTS.isPausedForConfirmation = false;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  removeTTSFullReadBanner();
  if (window.vedasWaveform && !state.isListening) window.vedasWaveform.setState('idle');
  if (!state.isListening) setHologramState('idle');
}

function showTTSFullReadBanner() {
  removeTTSFullReadBanner();
  const banner = document.createElement('div');
  banner.id = 'tts-read-full-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 28px;
    background: rgba(14, 20, 34, 0.95);
    border: 1px solid var(--cyan-neon);
    box-shadow: 0 0 25px rgba(0, 240, 255, 0.4);
    border-radius: 12px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 100;
    backdrop-filter: blur(16px);
    animation: toastIn 0.3s ease forwards;
  `;
  banner.innerHTML = `
    <span style="font-size:0.85rem; color:#fff;">🔊 <strong>Read full response?</strong> (Say "Yes" or click)</span>
    <button onclick="readFullResponse()" class="hud-btn" style="background:var(--cyan-neon); color:#000; font-weight:700; padding:4px 10px;">Yes, Read Full</button>
    <button onclick="stopSpeech()" class="hud-btn" style="padding:4px 8px;">✕</button>
  `;
  document.body.appendChild(banner);
}

function removeTTSFullReadBanner() {
  const el = document.getElementById('tts-read-full-banner');
  if (el) el.remove();
}

function onSpeechFinished(waitingForConfirmation) {
  if (!waitingForConfirmation) {
    removeTTSFullReadBanner();
  }
}

window.speakMessageManual = function (btn) {
  const bubble = btn.closest('.message-bubble');
  if (!bubble) return;
  const rawText = bubble.innerText;
  smartSpeakResponse(rawText);
};

window.readFullResponse = readFullResponse;
window.stopSpeech = stopSpeech;

// ----------------- VOICE ENGINE, WAKE-WORDS & HOTKEY CONVERSATION FLOW -----------------
let recognition = null;
let silenceTimer = null;
// 3200ms allows natural conversational breathing, pausing to think, and sentence structuring
const MIC_SILENCE_MS = 3200;
let voiceSessionPrefix = '';
let voiceRestartDebounce = null;

function clearSilenceTimer() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
}

function applyMicUi(listening) {
  if (micBtn) micBtn.classList.toggle('listening', listening);
  if (chatInput) {
    if (listening) {
      if (!chatInput.getAttribute('data-default-placeholder')) {
        chatInput.setAttribute('data-default-placeholder', chatInput.placeholder || '');
      }
      chatInput.placeholder = '🎙️ Listening... speak naturally (take your time, auto-sends after pause)';
    } else {
      const def = chatInput.getAttribute('data-default-placeholder');
      if (def) chatInput.placeholder = def;
    }
  }
  if (listening) {
    if (window.vedasWaveform) window.vedasWaveform.setState('listening');
    setHologramState('user_speaking');
  } else if (!state.isSpeaking) {
    if (window.vedasWaveform) window.vedasWaveform.setState('idle');
    setHologramState('idle');
  }
}

function haltMicForSpeech() {
  state.micArmed = false;
  state.isListening = false;
  clearSilenceTimer();
  clearTimeout(voiceRestartDebounce);
  voiceSessionPrefix = '';
  applyMicUi(false);
  if (recognition && state.recognitionActive) {
    try { recognition.abort(); } catch (e) {
      try { recognition.stop(); } catch (e2) {}
    }
  }
}

function initVoiceEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser.');
    if (micBtn) micBtn.title = 'Speech recognition not supported in browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionActive = true;
    if (!state.micArmed || state.isSpeaking) {
      try { recognition.abort(); } catch (e) {}
      return;
    }
    state.isListening = true;
    applyMicUi(true);
  };

  recognition.onresult = (event) => {
    if (!state.micArmed || state.isSpeaking) return;

    let sessionFinal = '';
    let sessionInterim = '';

    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        sessionFinal += event.results[i][0].transcript + ' ';
      } else {
        sessionInterim += event.results[i][0].transcript;
      }
    }

    // Combine any text persisted across recognition restarts with current session
    const fullText = (voiceSessionPrefix + sessionFinal + sessionInterim).trim();
    if (fullText) {
      chatInput.value = fullText;
      autoResizeChatInput();
    }

    // Reset silence timer on every chunk of speech detected (resets on breathing/speaking)
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      const query = (chatInput.value || '').trim();
      if (query) {
        commitVoiceTranscript(query);
      }
    }, MIC_SILENCE_MS);
  };

  recognition.onerror = (event) => {
    // 'no-speech' is emitted when there's a pause, breathing, or brief silence.
    // We intentionally ignore 'no-speech' and 'aborted' so the mic stays open.
    if (event.error === 'aborted' || event.error === 'no-speech') {
      return;
    }
    console.error('Speech Recognition Error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone permission denied', '⚠️');
      hardStopMic();
    }
  };

  recognition.onend = () => {
    state.recognitionActive = false;
    if (state.micArmed && !state.isSpeaking) {
      // Save current input value so browser auto-restart does not wipe speech
      if (chatInput && chatInput.value && chatInput.value.trim()) {
        voiceSessionPrefix = chatInput.value.trim() + ' ';
      }
      clearTimeout(voiceRestartDebounce);
      voiceRestartDebounce = setTimeout(() => {
        if (state.micArmed && !state.isSpeaking && !state.recognitionActive) {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Recognition restart handled:', e);
          }
        }
      }, 120);
      return;
    }
    state.isListening = false;
    applyMicUi(false);
  };
}

function commitVoiceTranscript(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) {
    hardStopMic();
    return;
  }

  const cleanTranscript = query.toLowerCase();

  if (state.currentTTS.isPausedForConfirmation) {
    hardStopMic();
    if (cleanTranscript.includes('yes') || cleanTranscript.includes('sure') || cleanTranscript.includes('read') || cleanTranscript.includes('continue') || cleanTranscript.includes('full')) {
      chatInput.value = '';
      readFullResponse();
      return;
    }
    if (cleanTranscript.includes('no') || cleanTranscript.includes('stop') || cleanTranscript.includes('never mind')) {
      chatInput.value = '';
      stopSpeech();
      return;
    }
  }

  const wakeWordMatch = query.match(/^(?:hey|hello|ok|okay)?\s*vedas\s*(.*)/i);
  let outbound = query;
  if (wakeWordMatch) {
    outbound = (wakeWordMatch[1] || '').trim();
    if (!outbound) {
      hardStopMic();
      smartSpeakResponse('I am listening. What is your command?');
      return;
    }
  }

  chatInput.value = outbound;
  hardStopMic();
  handleSendMessage();
}

function beginVoiceListening() {
  if (state.isSpeaking) {
    showToast('Wait until Vedas finishes speaking', '🔇');
    return;
  }
  if (!recognition) {
    initVoiceEngine();
    if (!recognition) {
      showToast('Speech Recognition API unavailable in this browser.', '⚠️');
      return;
    }
  }
  voiceSessionPrefix = '';
  clearTimeout(voiceRestartDebounce);
  clearSilenceTimer();

  state.micArmed = true;
  state.isListening = true;
  applyMicUi(true);
  showToast('Listening... Speak naturally (pause to send)', '🎙️');
  try {
    recognition.start();
  } catch (e) {
    console.error(e);
    showToast('Could not start voice recognition', '⚠️');
    hardStopMic();
  }
}

function hardStopMic() {
  state.micArmed = false;
  state.isListening = false;
  clearSilenceTimer();
  clearTimeout(voiceRestartDebounce);
  voiceSessionPrefix = '';
  applyMicUi(false);
  if (recognition && state.recognitionActive) {
    try { recognition.abort(); } catch (e) {
      try { recognition.stop(); } catch (e2) {}
    }
  }
}

function toggleVoiceListening() {
  if (state.isListening || state.micArmed || state.recognitionActive) {
    hardStopMic();
    showToast('Voice input stopped', '🔇');
    return;
  }
  beginVoiceListening();
}

function stopVoiceListening() {
  hardStopMic();
}

// ----------------- PYTHON SANDBOX CODE EXECUTION -----------------
window.executePythonSandbox = async function (encodedCode, btnElement) {
  const code = decodeURIComponent(encodedCode);
  const wrapper = btnElement.closest('.code-block-wrapper');
  const outputBox = wrapper ? wrapper.querySelector('.code-output-box') : null;

  btnElement.textContent = '⏳ Running...';
  btnElement.disabled = true;

  try {
    const res = await fetch('/api/execute-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const result = await res.json();
    if (outputBox) {
      outputBox.style.display = 'block';
      if (result.success) {
        outputBox.innerHTML = `<strong>Output (${result.duration}):</strong><pre style="margin-top:4px; color:#10b981;">${result.stdout || '(Process finished with exit code 0)'}</pre>`;
      } else {
        outputBox.innerHTML = `<strong>Execution Error (${result.duration}):</strong><pre style="margin-top:4px; color:#ff2a85;">${result.stderr || result.stdout}</pre>`;
      }
    }
  } catch (err) {
    if (outputBox) {
      outputBox.style.display = 'block';
      outputBox.innerHTML = `<span style="color:#ff2a85;">Network execution failed: ${err.message}</span>`;
    }
  } finally {
    btnElement.textContent = '▶ Run Code';
    btnElement.disabled = false;
  }
};

window.copyCodeSnippet = function (encodedCode, btnElement) {
  const code = decodeURIComponent(encodedCode);
  navigator.clipboard.writeText(code).then(() => {
    btnElement.textContent = '✅ Copied!';
    setTimeout(() => { btnElement.textContent = '📋 Copy'; }, 2000);
  });
};

// ----------------- SIDE CANVAS / IMAGE GENERATOR STUDIO -----------------
function openImageStudio() {
  if (!sideCanvas) return;
  sideCanvasTitle.innerHTML = '🎨 AI Neural Image Studio';
  sideCanvasBody.innerHTML = `
    <div class="drawer-section-title">✨ Synthesis Parameters</div>
    <div class="form-group">
      <label for="studio-prompt">
        <span>Prompt Vision</span>
        <span class="label-helper">Describe your concept in detail</span>
      </label>
      <textarea id="studio-prompt" class="form-control" rows="3" placeholder="A futuristic cyberpunk shrine in neon rain, 8k resolution, cinematic volumetric lighting..."></textarea>
    </div>

    <div class="form-group">
      <label>
        <span>Style Preset</span>
        <span class="label-helper" id="selected-style-label">Cinematic 8K</span>
      </label>
      <div class="pill-selector-grid" id="style-selector">
        <button type="button" class="pill-option active" data-style="cinematic">🎬 Cinematic 8K</button>
        <button type="button" class="pill-option" data-style="anime">🌸 Anime Shinkai</button>
        <button type="button" class="pill-option" data-style="cyberpunk">🌆 Cyberpunk 2077</button>
        <button type="button" class="pill-option" data-style="photorealistic">📸 Photorealistic</button>
        <button type="button" class="pill-option" data-style="3d_render">🧸 3D Pixar</button>
        <button type="button" class="pill-option" data-style="digital_art">🌌 Fantasy Art</button>
        <button type="button" class="pill-option" data-style="oil_painting">🎨 Oil Painting</button>
        <button type="button" class="pill-option" data-style="pixel_art">👾 Pixel Art</button>
      </div>
    </div>

    <div class="form-group">
      <label>
        <span>Aspect Ratio</span>
        <span class="label-helper" id="selected-ratio-label">1:1 Square</span>
      </label>
      <div class="pill-selector-grid ratio-grid" id="ratio-selector">
        <button type="button" class="pill-option active" data-ratio="1:1">⬛ 1:1 Square</button>
        <button type="button" class="pill-option" data-ratio="16:9">🖥️ 16:9 Cinema</button>
        <button type="button" class="pill-option" data-ratio="9:16">📱 9:16 Story</button>
      </div>
    </div>

    <button class="studio-generate-btn" id="studio-submit-btn">
      <span>✨</span> Generate Masterpiece
    </button>
    <div id="studio-preview-area"></div>
  `;

  const styleLabel = document.getElementById('selected-style-label');
  const styleOptions = sideCanvasBody.querySelectorAll('#style-selector .pill-option');
  styleOptions.forEach(opt => {
    opt.onclick = () => {
      styleOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (styleLabel) styleLabel.textContent = opt.textContent.replace(/^[^\w]+/, '').trim();
    };
  });

  const ratioLabel = document.getElementById('selected-ratio-label');
  const ratioOptions = sideCanvasBody.querySelectorAll('#ratio-selector .pill-option');
  ratioOptions.forEach(opt => {
    opt.onclick = () => {
      ratioOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (ratioLabel) ratioLabel.textContent = opt.textContent.replace(/^[^\w]+/, '').trim();
    };
  });

  document.getElementById('studio-submit-btn').onclick = runStudioImageGen;
  sideCanvas.classList.add('open');
  const backdrop = document.getElementById('drawer-backdrop');
  if (backdrop) backdrop.classList.add('active');
}

async function runStudioImageGen() {
  const promptInput = document.getElementById('studio-prompt');
  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please specify a prompt for the studio.', '⚠️');
    return;
  }

  const activeStyle = sideCanvasBody.querySelector('#style-selector .pill-option.active')?.dataset.style || 'cinematic';
  const activeRatio = sideCanvasBody.querySelector('#ratio-selector .pill-option.active')?.dataset.ratio || '1:1';
  const previewArea = document.getElementById('studio-preview-area');
  const submitBtn = document.getElementById('studio-submit-btn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳</span> Synthesizing Art...';
  previewArea.innerHTML = `
    <div class="studio-loading-box" style="margin-top:16px;">
      <div class="studio-spinner"></div>
      <div class="studio-loading-text">Synthesizing High-Res Art...</div>
      <div class="studio-loading-sub">Engine: FLUX / Pollinations Ultra HD</div>
    </div>
  `;

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        style: activeStyle,
        aspect_ratio: activeRatio,
        enhance_prompt: true
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Art generation error');
    }
    const imgUrl = data.data_uri || data.url;
    previewArea.innerHTML = `
      <div class="generated-image-card" style="margin-top:14px;">
        <img src="${imgUrl}" alt="Studio Art" onclick="openLightbox('${imgUrl}')" />
        <div class="img-overlay-tools">
          <span class="img-tag-info">${data.width || 1024}x${data.height || 1024} • ${(data.style || activeStyle).toUpperCase()}</span>
          <button class="img-btn" onclick="downloadImage('${imgUrl}', 'studio_vedas_${Date.now()}.jpg')">⬇ Download</button>
        </div>
      </div>
    `;
    showToast('Artwork Synthesis Complete!', '🎨');
  } catch (err) {
    previewArea.innerHTML = `
      <div class="studio-error-box" style="margin-top:16px;">
        <span>⚠️</span> Image generation failed: ${escapeHtml(err.message)}
      </div>
    `;
    showToast('Image Generation Failed', '⚠️');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>✨</span> Generate Masterpiece';
  }
}

function openMemoryStudio() {
  if (!sideCanvas) return;
  sideCanvasTitle.innerHTML = '🧠 Long-Term Memory Core';
  sideCanvasBody.innerHTML = `
    <div class="drawer-section-title">🧠 Knowledge Acquisition</div>
    <div class="form-group">
      <label for="new-memory-input">
        <span>Store New Knowledge</span>
        <span class="label-helper">Persisted across all sessions</span>
      </label>
      <div class="input-with-action">
        <input type="text" id="new-memory-input" class="form-control" placeholder="e.g. User prefers Python, Dark Mode, and Concise answers..." autocomplete="off" />
        <button class="studio-generate-btn memory-save-btn" id="save-memory-btn" onclick="saveNewMemoryNote()">
          <span>+</span> Save
        </button>
      </div>
    </div>

    <div class="drawer-divider"></div>

    <div class="form-group" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
      <label style="margin-bottom:6px;">
        <span>Stored Knowledge Items</span>
        <span class="memory-count-badge" id="memory-count-badge">${state.memoryNotes.length} notes</span>
      </label>
      <div id="full-memory-list" class="full-memory-container"></div>
    </div>
  `;

  const input = document.getElementById('new-memory-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNewMemoryNote();
      }
    });
  }

  renderFullMemoryList();
  sideCanvas.classList.add('open');
  const backdrop = document.getElementById('drawer-backdrop');
  if (backdrop) backdrop.classList.add('active');
}

function renderFullMemoryList() {
  const container = document.getElementById('full-memory-list');
  const countBadge = document.getElementById('memory-count-badge');
  if (countBadge) {
    countBadge.textContent = `${state.memoryNotes.length} notes`;
  }
  if (!container) return;
  container.innerHTML = '';

  if (state.memoryNotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <span class="empty-icon">🧠</span>
        <div class="empty-title">Memory Bank Empty</div>
        <div class="empty-desc">Teach Vedas about your preferences, stack, or facts. Vedas will autonomously utilize context in conversations.</div>
      </div>
    `;
    return;
  }

  state.memoryNotes.forEach((note, idx) => {
    const item = document.createElement('div');
    item.className = 'memory-card-item';
    item.innerHTML = `
      <div class="memory-card-content">
        <span class="memory-pin">📌</span>
        <span class="memory-text">${escapeHtml(note)}</span>
      </div>
      <div class="memory-card-actions">
        <button class="memory-action-btn memory-del-btn" title="Forget Note" onclick="deleteMemoryNoteFull(${idx})">🗑️</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.saveNewMemoryNote = async function () {
  const input = document.getElementById('new-memory-input');
  const note = input ? input.value.trim() : '';
  if (!note) {
    showToast('Please type a note or fact to remember.', '⚠️');
    return;
  }

  try {
    const res = await fetch('/api/memory/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (res.ok) {
      const data = await res.json();
      state.memoryNotes = data.notes || [];
      input.value = '';
      renderSidebarMemory();
      renderFullMemoryList();
      showToast('Knowledge Ingested into Vedas Core', '🧠');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to save memory note', '⚠️');
  }
};

window.deleteMemoryNoteFull = async function (idx) {
  try {
    const res = await fetch(`/api/memory/notes/${idx}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      state.memoryNotes = data.notes || [];
      renderSidebarMemory();
      renderFullMemoryList();
      showToast('Memory Note Erased', '🗑️');
    }
  } catch (err) {
    console.error(err);
  }
};

function closeSideCanvas() {
  if (sideCanvas) sideCanvas.classList.remove('open');
  const backdrop = document.getElementById('drawer-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

// ----------------- LIGHTBOX & DOWNLOAD -----------------
window.openLightbox = function (src) {
  if (lightboxImg && lightboxModal) {
    lightboxImg.src = src;
    lightboxModal.classList.add('open');
  }
};

window.closeLightbox = function () {
  if (lightboxModal) lightboxModal.classList.remove('open');
};

window.downloadImage = function (url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'vedas_render.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Downloading Image...', '📥');
};

// ----------------- AUTO-RESIZE CHAT INPUT -----------------
function autoResizeChatInput() {
  if (!chatInput) return;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
}

// ----------------- GLOBAL KEYBOARD HOTKEYS -----------------
window.addEventListener('keydown', (e) => {
  // Hotkey: Ctrl+M or Alt+V to toggle Mic
  if ((e.ctrlKey && e.key.toLowerCase() === 'm') || (e.altKey && e.key.toLowerCase() === 'v')) {
    e.preventDefault();
    toggleVoiceListening();
    return;
  }

  // Hotkey: Escape to close modals/drawers or stop TTS
  if (e.key === 'Escape') {
    closeLightbox();
    closeSideCanvas();
    stopSpeech();
  }
});

// ----------------- EVENT LISTENERS & INITIALIZATION -----------------
document.addEventListener('DOMContentLoaded', () => {
  // Chat input key handling
  if (chatInput) {
    chatInput.addEventListener('input', autoResizeChatInput);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
  if (micBtn) micBtn.addEventListener('click', toggleVoiceListening);
  if (fileInput) fileInput.addEventListener('change', handleFileSelect);

  // File Upload Trigger Button
  const uploadBtn = document.getElementById('upload-trigger-btn');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
  }

  // Web Search Toggle
  if (webSearchBtn) {
    webSearchBtn.addEventListener('click', () => {
      state.useWebSearch = !state.useWebSearch;
      webSearchBtn.classList.toggle('active', state.useWebSearch);
      showToast(state.useWebSearch ? 'Live Web Search Armed' : 'Web Search Standby', '🌐');
    });
  }

  // Model Selector
  if (modelSelector) {
    modelSelector.addEventListener('change', (e) => {
      state.activeModel = e.target.value;
      showToast(`Active Core: ${state.activeModel}`, '⚡');
    });
  }

  // Persona Selector
  if (personaSelector) {
    personaSelector.addEventListener('change', (e) => {
      state.currentPersona = e.target.value;
      showToast(`Persona: ${e.target.options[e.target.selectedIndex].text}`, '🎭');
    });
  }

  // Sidebar Tab Switching
  const sessionTabBtn = document.getElementById('tab-sessions-btn');
  const memoryTabBtn = document.getElementById('tab-memory-btn');
  if (sessionTabBtn && memoryTabBtn) {
    sessionTabBtn.onclick = () => {
      sessionTabBtn.classList.add('active');
      memoryTabBtn.classList.remove('active');
      sessionsList.style.display = 'flex';
      memoryList.style.display = 'none';
    };
    memoryTabBtn.onclick = () => {
      memoryTabBtn.classList.add('active');
      sessionTabBtn.classList.remove('active');
      sessionsList.style.display = 'none';
      memoryList.style.display = 'flex';
    };
  }

  // Quick Action Card triggers from Welcome Hero
  document.querySelectorAll('.quick-card').forEach(card => {
    card.onclick = () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        if (prompt.startsWith('/image') || prompt.startsWith('create an image')) {
          openImageStudio();
        } else {
          chatInput.value = prompt;
          handleSendMessage();
        }
      }
    };
  });

  // Drag & drop files onto chat (supports PDFs, images, docs)
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Lightbox close
  if (lightboxModal) {
    lightboxModal.onclick = (e) => {
      if (e.target === lightboxModal) closeLightbox();
    };
  }

  // Start background services & telemetry loop
  fetchSystemStatus();
  setInterval(fetchSystemStatus, 6000);
  loadSessionsAndMemory();
  initVoiceEngine();
});

// ----------------- HOLOGRAM CONTROL -----------------
function setHologramState(st) {
  if (window.VedasHologram) {
    window.VedasHologram.setState(st);
  }
}

// ----------------- SYSTEM COMMANDS -----------------
window.runSysCmd = async function(cmd) {
  try {
    const res = await fetch('/api/system/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, '⚡');
      // Also speak the response
      if (state.speechSynthEnabled) smartSpeakResponse(data.message);
    } else {
      showToast(data.message || 'Command failed', '⚠️');
    }
  } catch (err) {
    showToast('System command failed: ' + err.message, '❌');
  }
};

window.confirmShutdown = function() {
  const modal = document.getElementById('shutdown-confirm-modal');
  if (modal) modal.classList.add('open');
};

window.closeShutdownModal = function() {
  const modal = document.getElementById('shutdown-confirm-modal');
  if (modal) modal.classList.remove('open');
};

window.executeShutdown = async function() {
  closeShutdownModal();
  await runSysCmd('shutdown');
};

window.confirmRestart = function() {
  const modal = document.getElementById('restart-confirm-modal');
  if (modal) modal.classList.add('open');
};

window.closeRestartModal = function() {
  const modal = document.getElementById('restart-confirm-modal');
  if (modal) modal.classList.remove('open');
};

window.executeRestart = async function() {
  closeRestartModal();
  await runSysCmd('restart');
};

// Dismiss modals on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeShutdownModal();
    closeRestartModal();
  }
});

// Detect voice system commands
function checkVoiceSystemCommand(text) {
  const t = text.toLowerCase().trim();
  const sysPatterns = [
    /^open\s+(notepad|calculator|paint|chrome|browser|explorer|file manager|task manager|terminal|cmd|command prompt|word|excel|vlc|spotify|discord|settings|control panel|snipping tool|screenshot)/i,
    /^(shutdown|shut down|power off|restart|reboot|sleep|hibernate|cancel shutdown|abort shutdown)/i,
    /^(mute|unmute|volume\s+\d+)/i,
    /^lock (screen|computer)/i
  ];
  return sysPatterns.some(p => p.test(t));
}

// ----------------- FILE MANAGER -----------------
let fmCurrentPath = null;
let fmParentPath = null;

window.openFileManager = async function() {
  const sideCanvas = document.getElementById('side-canvas');
  const sideCanvasTitle = document.getElementById('side-canvas-title');
  const sideCanvasBody = document.getElementById('side-canvas-body');
  if (!sideCanvas) return;

  sideCanvasTitle.innerHTML = '📁 File & Folder Manager';
  sideCanvasBody.innerHTML = `
    <div class="drawer-section-title">📁 FILE SYSTEM EXPLORER</div>
    <div class="file-manager-toolbar" id="fm-toolbar">
      <input type="text" class="fm-path-bar" id="fm-path-input" placeholder="Enter path..." />
      <button class="fm-toolbar-btn" onclick="fmNavigatePath()">Go</button>
      <button class="fm-toolbar-btn" onclick="fmGoUp()">↑ Up</button>
      <button class="fm-toolbar-btn" onclick="fmRefresh()">🔄</button>
    </div>
    <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
      <button class="fm-toolbar-btn" onclick="fmCreateItem(false)">+ New File</button>
      <button class="fm-toolbar-btn" onclick="fmCreateItem(true)">+ New Folder</button>
    </div>
    <div class="fm-items-list" id="fm-items-list">Loading...</div>
  `;

  const pathInput = document.getElementById('fm-path-input');
  if (pathInput) {
    pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fmNavigatePath();
    });
  }

  sideCanvas.classList.add('open');
  const backdrop = document.getElementById('drawer-backdrop');
  if (backdrop) backdrop.classList.add('active');

  await fmBrowse(null);
};

async function fmBrowse(path) {
  const list = document.getElementById('fm-items-list');
  if (!list) return;
  list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim);">Loading...</div>`;

  try {
    const res = await fetch('/api/files/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Browse failed');

    fmCurrentPath = data.current_path;
    fmParentPath = data.parent || null;
    const pathInput = document.getElementById('fm-path-input');
    if (pathInput) pathInput.value = fmCurrentPath;

    list.innerHTML = '';

    if (data.parent) {
      const upItem = document.createElement('div');
      upItem.className = 'fm-item';
      upItem.innerHTML = `<span class="fm-item-icon">⬆️</span><span class="fm-item-name">.. (Parent)</span>`;
      upItem.onclick = () => fmBrowse(data.parent);
      list.appendChild(upItem);
    }

    if (data.items.length === 0) {
      list.innerHTML += `<div style="color:var(--text-dim); padding:12px; font-size:0.82rem;">Empty directory</div>`;
    }

    data.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'fm-item';
      const icon = item.is_dir ? '📁' : getFileIcon(item.name);
      const sizeStr = item.is_dir ? '' : formatBytes(item.size);
      const encodedPath = encodeURIComponent(item.path);

      el.innerHTML = `
        <span class="fm-item-icon">${icon}</span>
        <span class="fm-item-name">${escapeHtml(item.name)}</span>
        <span class="fm-item-meta">${sizeStr || ''}</span>
        <div class="fm-item-actions">
          ${!item.is_dir ? `<button class="fm-action-btn" title="Edit" onclick="fmEditFile('${encodedPath}', event)">✏️</button>` : ''}
          <button class="fm-action-btn" title="Rename" onclick="fmRenamePrompt('${encodedPath}', '${escapeHtml(item.name)}', event)">📝</button>
          <button class="fm-action-btn danger" title="Delete" onclick="fmDeleteItem('${encodedPath}', event)">🗑️</button>
        </div>
      `;

      if (item.is_dir) {
        el.onclick = (e) => {
          if (!e.target.closest('.fm-item-actions')) fmBrowse(item.path);
        };
      }

      list.appendChild(el);
    });
  } catch (err) {
    list.innerHTML = `<div style="color:var(--pink-neon); padding:12px;">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}

window.fmNavigatePath = function() {
  const input = document.getElementById('fm-path-input');
  if (input && input.value.trim()) fmBrowse(input.value.trim());
};

window.fmGoUp = function() {
  if (fmParentPath) {
    fmBrowse(fmParentPath);
  }
};

window.fmRefresh = function() {
  fmBrowse(fmCurrentPath);
};

window.fmEditFile = async function(encodedPath, event) {
  event.stopPropagation();
  const path = decodeURIComponent(encodedPath);
  try {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Cannot read file');
    const data = await res.json();

    const body = document.getElementById('side-canvas-body');
    body.innerHTML = `
      <div class="fm-editor-area">
        <div class="fm-editor-header">
          <span class="fm-editor-filename">✏️ ${escapeHtml(data.name)}</span>
          <button class="fm-toolbar-btn" onclick="openFileManager()">← Back</button>
        </div>
        <textarea class="fm-editor-textarea" id="fm-editor-content">${escapeHtml(data.content)}</textarea>
        <button class="fm-save-btn" onclick="fmSaveFile('${encodedPath}')">
          💾 Save File
        </button>
      </div>
    `;
  } catch (err) {
    showToast('Cannot open file: ' + err.message, '❌');
  }
};

window.fmSaveFile = async function(encodedPath) {
  const path = decodeURIComponent(encodedPath);
  const textarea = document.getElementById('fm-editor-content');
  if (!textarea) return;
  const content = textarea.value;
  try {
    const res = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, '✅');
    } else {
      showToast('Save failed', '❌');
    }
  } catch (err) {
    showToast('Save error: ' + err.message, '❌');
  }
};

window.fmCreateItem = async function(isFolder) {
  const name = prompt(isFolder ? 'New folder name:' : 'New file name:');
  if (!name || !name.trim()) return;
  const fullPath = (fmCurrentPath ? fmCurrentPath.replace(/\\/g, '/') + '/' : '') + name.trim();
  try {
    const res = await fetch('/api/files/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath, is_folder: isFolder })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, '✅');
      fmRefresh();
    } else {
      showToast(data.detail || 'Create failed', '❌');
    }
  } catch (err) {
    showToast('Create error: ' + err.message, '❌');
  }
};

window.fmRenamePrompt = async function(encodedPath, currentName, event) {
  event.stopPropagation();
  const path = decodeURIComponent(encodedPath);
  const newName = prompt('Rename to:', currentName);
  if (!newName || !newName.trim() || newName.trim() === currentName) return;
  try {
    const res = await fetch('/api/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, new_name: newName.trim() })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, '✅');
      fmRefresh();
    } else {
      showToast(data.detail || 'Rename failed', '❌');
    }
  } catch (err) {
    showToast('Rename error: ' + err.message, '❌');
  }
};

window.fmDeleteItem = async function(encodedPath, event) {
  event.stopPropagation();
  const path = decodeURIComponent(encodedPath);
  const name = path.split(/[\\/]/).pop();
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, '🗑️');
      fmRefresh();
    } else {
      showToast(data.detail || 'Delete failed', '❌');
    }
  } catch (err) {
    showToast('Delete error: ' + err.message, '❌');
  }
};

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    py: '🐍', js: '📜', ts: '📘', html: '🌐', css: '🎨',
    json: '📋', md: '📝', txt: '📄', pdf: '📕', png: '🖼️',
    jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🎨', mp4: '🎬',
    mp3: '🎵', wav: '🎵', zip: '📦', exe: '⚙️', sh: '🔧',
    bat: '⚙️', csv: '📊', xml: '📋', yaml: '⚙️', yml: '⚙️'
  };
  return icons[ext] || '📄';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
