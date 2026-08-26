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
        ollamaText.textContent = `OLLAMA: ${data.active_local_model}`;
      } else {
        ollamaDot.className = 'status-dot danger';
        ollamaText.textContent = 'OLLAMA: OFFLINE';
      }
    }

    // Populate model options
    if (modelSelector && data.local_models && modelSelector.options.length <= 2) {
      modelSelector.innerHTML = '';
      const localGroup = document.createElement('optgroup');
      localGroup.label = '⚡ Local Ollama Models (Primary)';
      data.local_models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `Local: ${m}`;
        if (m === data.active_local_model) opt.selected = true;
        localGroup.appendChild(opt);
      });
      modelSelector.appendChild(localGroup);

      const cloudGroup = document.createElement('optgroup');
      cloudGroup.label = '☁️ Gemini Cloud Models (Fallback & Supervisor)';
      const geminiList = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview'];
      geminiList.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `Cloud: ${m}`;
        cloudGroup.appendChild(opt);
      });
      modelSelector.appendChild(cloudGroup);
    }
  } catch (err) {
    console.error('Telemetry Error:', err);
  }
}

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
    return;
  }

  if (welcomeHero) welcomeHero.style.display = 'none';

  messages.forEach(msg => {
    appendMessageToDOM(msg.role, msg.content, msg.meta, false);
  });

  scrollChatToBottom();
}

function appendMessageToDOM(role, content, meta = {}, shouldScroll = true) {
  if (welcomeHero) welcomeHero.style.display = 'none';

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
    const modelTag = meta && meta.model ? meta.model : 'Vedas';
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

function scrollChatToBottom() {
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
}

// ----------------- SEND MESSAGE HANDLER -----------------
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text && state.attachments.length === 0) return;

  if (!state.currentSessionId) {
    state.currentSessionId = String(Date.now());
    state.sessions.unshift({
      id: state.currentSessionId,
      title: text ? (text.length > 25 ? text.substring(0, 22) + '...' : text) : 'Attachment Query',
      messages: []
    });
  }

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
  const userAttachments = [...state.attachments];

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

  // Set waveform to thinking/speaking
  if (window.vedasWaveform) window.vedasWaveform.setState('speaking');

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

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
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

    if (currentSession) currentSession.messages.push(aiMsg);
    appendMessageToDOM('ai', aiMsg.content, aiMsg.meta);
    saveCurrentSessionToBackend();

    // Voice response with two-stage confirmation TTS
    if (state.speechSynthEnabled && data.text) {
      smartSpeakResponse(data.text);
    }
  } catch (err) {
    console.error('Chat Error:', err);
    appendMessageToDOM('ai', `⚠️ Neural Core Interruption: ${err.message}\n\nPlease verify that the backend server is running.`);
  } finally {
    if (window.vedasWaveform && !state.isListening) {
      window.vedasWaveform.setState('idle');
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
    if (window.vedasWaveform) window.vedasWaveform.setState('speaking');
  };

  utterance.onend = () => {
    if (window.vedasWaveform && !state.isListening) window.vedasWaveform.setState('idle');
    if (onEndCallback) onEndCallback();
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
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  state.currentTTS.isPausedForConfirmation = false;
  removeTTSFullReadBanner();
  if (window.vedasWaveform) window.vedasWaveform.setState('idle');
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
  if (waitingForConfirmation) {
    // Open mic in continuous conversation mode so user can simply say "Yes"
    if (state.inConversationMode && recognition) {
      try {
        state.isListening = true;
        recognition.start();
        if (micBtn) micBtn.classList.add('listening');
        if (window.vedasWaveform) window.vedasWaveform.setState('listening');
      } catch (e) {}
    }
  } else {
    removeTTSFullReadBanner();
    // Auto-reopen listening for follow-up turns without wake-word
    if (state.inConversationMode && recognition) {
      try {
        state.isListening = true;
        recognition.start();
        if (micBtn) micBtn.classList.add('listening');
        if (window.vedasWaveform) window.vedasWaveform.setState('listening');

        clearTimeout(state.conversationTimeoutId);
        state.conversationTimeoutId = setTimeout(() => {
          if (state.isListening) {
            stopVoiceListening();
            state.inConversationMode = false;
          }
        }, 10000);
      } catch (e) {}
    }
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

  recognition.onstart = () => {
    state.isListening = true;
    if (micBtn) micBtn.classList.add('listening');
    if (window.vedasWaveform) window.vedasWaveform.setState('listening');
    if (!state.inConversationMode) {
      showToast('Listening... [Hotkey: Ctrl+M]', '🎙️');
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (interimTranscript) {
      chatInput.value = interimTranscript;
    }

    if (finalTranscript) {
      const cleanTranscript = finalTranscript.trim().toLowerCase();

      // Check if user is answering the "Should I read it to you in full?" prompt
      if (state.currentTTS.isPausedForConfirmation) {
        if (cleanTranscript.includes('yes') || cleanTranscript.includes('sure') || cleanTranscript.includes('read') || cleanTranscript.includes('continue') || cleanTranscript.includes('full')) {
          chatInput.value = '';
          readFullResponse();
          return;
        } else if (cleanTranscript.includes('no') || cleanTranscript.includes('stop') || cleanTranscript.includes('never mind')) {
          chatInput.value = '';
          stopSpeech();
          return;
        }
      }

      const wakeWordMatch = finalTranscript.trim().match(/^(?:hey|hello|ok|okay)?\s*vedas\s*(.*)/i);

      // If in ongoing conversation mode, user DOES NOT need to repeat "Hello Vedas"
      if (state.inConversationMode) {
        const query = wakeWordMatch ? wakeWordMatch[1].trim() : finalTranscript.trim();
        if (query) {
          chatInput.value = query;
          handleSendMessage();
        }
      } else {
        // First time / standby: wake word OR direct speech if button was clicked
        if (wakeWordMatch) {
          state.inConversationMode = true;
          const query = wakeWordMatch[1].trim();
          if (query) {
            chatInput.value = query;
            handleSendMessage();
          } else {
            smartSpeakResponse("I am listening. What is your command?");
          }
        } else {
          // Direct speech
          state.inConversationMode = true;
          chatInput.value = finalTranscript.trim();
          handleSendMessage();
        }
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech Recognition Error:', event.error);
    stopVoiceListening();
  };

  recognition.onend = () => {
    if (state.isListening) {
      try { recognition.start(); } catch (e) {}
    } else {
      stopVoiceListening();
    }
  };
}

function toggleVoiceListening() {
  if (!recognition) {
    initVoiceEngine();
    if (!recognition) {
      showToast('Speech Recognition API unavailable in this browser.', '⚠️');
      return;
    }
  }

  if (state.isListening) {
    stopVoiceListening();
  } else {
    state.inConversationMode = true;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  }
}

function stopVoiceListening() {
  state.isListening = false;
  if (micBtn) micBtn.classList.remove('listening');
  if (window.vedasWaveform) window.vedasWaveform.setState('idle');
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
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
