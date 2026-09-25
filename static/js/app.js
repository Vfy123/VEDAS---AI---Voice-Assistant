/**
 * ==============================================================================
 * VEDAS AI 3.7 PRO — Master Application Controller
 * High-End Production Edition:
 * - Permanent Left Sidebar with full navigation
 * - AI Chatbot with Markdown, Code Copy, Attachments & Voice Mic
 * - Dedicated Views: Dashboard, Talk HUD, Codex Lab, Image Studio, Memory, Files, Commands, Settings
 * - Full Configuration Persistence & Real-time Synchronization
 * ==============================================================================
 */

// Application Master State
const state = {
  currentView: 'chat',
  currentSessionId: null,
  sessions: [],
  memoryNotes: [],
  attachments: [],
  useWebSearch: false,
  isListening: false,
  speechSynthEnabled: true,
  currentPersona: 'master_vedas',
  activeModel: 'llama3.2:latest',
  systemStatus: {},
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
  }
};

// DOM References
let chatMessagesContainer, welcomeHero, chatInput, sendBtn, micBtn;
let fileInput, attachmentTray, sessionsList, modelSelector, personaSelector;

document.addEventListener('DOMContentLoaded', async () => {
  cacheDOM();
  initLiveClock();
  initEventListeners();
  initSpeechRecognition();

  // Apply saved theme immediately
  try {
    const savedTheme = localStorage.getItem('vedas_theme') || 'blue_orange';
    if (window.applyTheme) window.applyTheme(savedTheme);
  } catch (e) {}

  // Load backend data
  await fetchSystemStatus();
  await loadStoredMemory();
  await loadStoredSessions();
  await loadSettingsFromServer();

  // Default view is AI Chatbot (#1 Intelligence Core)
  switchView('chat');
});

function cacheDOM() {
  chatMessagesContainer = document.getElementById('chat-messages-container');
  welcomeHero = document.getElementById('welcome-hero');
  chatInput = document.getElementById('chat-input');
  sendBtn = document.getElementById('send-btn');
  micBtn = document.getElementById('mic-btn');
  fileInput = document.getElementById('file-input');
  attachmentTray = document.getElementById('attachment-tray');
  sessionsList = document.getElementById('sessions-list');
  modelSelector = document.getElementById('model-selector');
  personaSelector = document.getElementById('persona-selector');
}

// ==============================================================================
// MULTI-VIEW NAVIGATION
// ==============================================================================
window.switchView = function(viewName) {
  state.currentView = viewName;

  // Sidebar navigation active highlight
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  const activeNav = document.getElementById(`nav-item-${viewName}`);
  if (activeNav) activeNav.classList.add('active');

  // Switch visible view panel
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = (viewName === 'chat') ? 'flex' : 'block';
    targetView.classList.add('active');
  }

  // View specific setups
  if (viewName === 'chat' && chatInput) {
    setTimeout(() => chatInput.focus(), 50);
  } else if (viewName === 'codex') {
    initCodexEditor();
  } else if (viewName === 'files') {
    loadFilesBrowser();
  } else if (viewName === 'memory') {
    renderMemoryPage();
  } else if (viewName === 'settings') {
    loadSettingsFromServer();
  }
};

// ==============================================================================
// LIVE CLOCK & GREETING
// ==============================================================================
function initLiveClock() {
  function update() {
    const now = new Date();
    const clockEl = document.getElementById('home-live-clock');
    const dateEl = document.getElementById('home-live-date');
    const greetingEl = document.getElementById('home-greeting');

    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    if (greetingEl) {
      const hour = now.getHours();
      let greeting = 'Good day';
      if (hour >= 5 && hour < 12) greeting = 'Good morning';
      else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
      else if (hour >= 17 && hour < 22) greeting = 'Good evening';
      greetingEl.textContent = `${greeting}, Commander.`;
    }
  }
  update();
  setInterval(update, 1000);
}

// ==============================================================================
// CHAT & MESSAGING ENGINE
// ==============================================================================
window.activeChatAbortController = null;

function setGeneratingState(isGenerating) {
  const stopBtn = document.getElementById('stop-btn');
  if (stopBtn) stopBtn.style.display = isGenerating ? 'flex' : 'none';
}

function setSpeakingState(isSpeaking) {
  state.isSpeaking = isSpeaking;
  state.isMicLocked = isSpeaking;

  const stopBtn = document.getElementById('stop-btn');
  if (stopBtn && !window.activeChatAbortController) {
    stopBtn.style.display = isSpeaking ? 'flex' : 'none';
  }

  const chatMic = document.getElementById('chat-mic-orb-btn');
  const chatTr = document.getElementById('chat-voice-transcript');

  if (isSpeaking) {
    // If user was speaking, pause listening immediately to avoid speaker audio loops
    if (state.isListening) {
      stopVoiceListening();
    }
    if (chatMic) {
      chatMic.classList.add('mic-locked');
      chatMic.title = '🔒 Microphone locked while AI is speaking (Click Stop to interrupt)';
      const glyph = document.getElementById('chat-mic-glyph');
      if (glyph) glyph.textContent = '🔒';
    }
    if (chatTr) {
      chatTr.textContent = '🔊 AI Speaking... (Mic locked)';
      chatTr.className = 'dock-voice-caption speaking';
    }
  } else {
    if (chatMic) {
      chatMic.classList.remove('mic-locked');
      chatMic.title = 'Click or Press Ctrl+M to Speak';
      const glyph = document.getElementById('chat-mic-glyph');
      if (glyph) glyph.textContent = '🎙️';
    }
    if (chatTr && !state.isListening) {
      chatTr.textContent = 'Click the orb or press Ctrl+M to talk';
      chatTr.className = 'dock-voice-caption';
    }
  }
}

window.stopAllAIResponse = function() {
  let stoppedSomething = false;

  // 1. Abort active network request if ongoing
  if (window.activeChatAbortController) {
    try {
      window.activeChatAbortController.abort();
      stoppedSomething = true;
    } catch (e) {}
    window.activeChatAbortController = null;
  }

  // 2. Cancel active browser speech synthesis
  if (window.speechSynthesis) {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      stoppedSomething = true;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  // 3. Stop voice recognition if listening
  if (state.isListening) {
    stopVoiceListening();
    stoppedSomething = true;
  }

  // 4. Remove any active thinking bubble
  const thinkingElements = document.querySelectorAll('[id^="thinking-"]');
  if (thinkingElements.length > 0) {
    thinkingElements.forEach(el => el.remove());
    stoppedSomething = true;
  }

  // 5. Dismiss floating read full prompt if open
  dismissReadFullPrompt(false);

  // 6. Reset UI & waveform states
  setGeneratingState(false);
  setSpeakingState(false);

  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
  if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');

  const holoStatus = document.getElementById('holo-status-text');
  if (holoStatus) holoStatus.textContent = 'CORE SYNCHRONIZED';

  const chatTr = document.getElementById('chat-voice-transcript');
  if (chatTr) {
    chatTr.textContent = 'Click the orb or press Ctrl+M to talk';
    chatTr.className = 'dock-voice-caption';
  }

  showToast('AI response stopped.', '⏹️');
};

// Global keyboard shortcut: Esc stops AI response & voice output
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (window.activeChatAbortController || (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) || state.isListening) {
      stopAllAIResponse();
    }
  }
});

async function handleSendMessage() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  const attachments = [...state.attachments];

  if (!text && attachments.length === 0) return;

  chatInput.value = '';
  state.attachments = [];
  renderAttachmentTray();

  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) chatMessagesContainer.style.display = 'flex';

  addMessageBubble('user', text, { attachments });

  const thinkingId = 'thinking-' + Date.now();
  addThinkingBubble(thinkingId);
  setGeneratingState(true);

  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('thinking');
  if (window.vedasDashWaveform) window.vedasDashWaveform.setState('thinking');
  const holoStatus = document.getElementById('holo-status-text');
  if (holoStatus) holoStatus.textContent = 'SYNTHESIZING...';

  if (window.activeChatAbortController) {
    try { window.activeChatAbortController.abort(); } catch (e) {}
  }
  window.activeChatAbortController = new AbortController();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        session_id: state.currentSessionId,
        persona: (personaSelector ? personaSelector.value : state.currentPersona) || 'master_vedas',
        model_override: (modelSelector ? modelSelector.value : state.activeModel),
        use_web_search: state.useWebSearch,
        attachments: attachments
      }),
      signal: window.activeChatAbortController.signal
    });

    window.activeChatAbortController = null;
    removeThinkingBubble(thinkingId);
    setGeneratingState(false);

    const data = await res.json();
    const reply = data.text || data.message || 'Action executed.';
    addMessageBubble('assistant', reply, data);

    if (holoStatus) holoStatus.textContent = 'CORE SYNCHRONIZED';
    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
    if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');

    if (state.speechSynthEnabled) {
      smartSpeakResponse(reply);
    }

    saveActiveSession();
  } catch (err) {
    window.activeChatAbortController = null;
    removeThinkingBubble(thinkingId);
    setGeneratingState(false);

    if (holoStatus) holoStatus.textContent = 'CORE SYNCHRONIZED';
    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
    if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');

    if (err.name === 'AbortError') {
      addMessageBubble('assistant', '⏹️ *Response stopped by user.*', { isStopped: true });
    } else {
      addMessageBubble('assistant', `⚠️ Communication error: ${err.message}`, { isError: true });
    }
  }
}

function addMessageBubble(role, text, meta = {}) {
  if (!chatMessagesContainer) return;

  const row = document.createElement('div');
  row.className = `chat-message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = role === 'user' ? '👤' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (meta.attachments && meta.attachments.length > 0) {
    const attGrid = document.createElement('div');
    attGrid.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;';
    meta.attachments.forEach(att => {
      const chip = document.createElement('span');
      chip.style.cssText = 'background:rgba(0,0,0,0.3); padding:3px 8px; border-radius:4px; font-size:0.75rem;';
      chip.textContent = `📎 ${att.name || 'File'}`;
      attGrid.appendChild(chip);
    });
    bubble.appendChild(attGrid);
  }

  if (meta.screenshot_preview || meta.preview_data_uri) {
    const previewSrc = meta.screenshot_preview || meta.preview_data_uri;
    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = 'margin-bottom:10px; cursor:pointer;';
    imgWrapper.innerHTML = `
      <img src="${previewSrc}" alt="Screen Vision Capture" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid var(--border-glass); display:block;" onclick="openLightbox('${previewSrc}')" />
      <div style="font-size:0.72rem; color:var(--blue-bright); margin-top:4px;">📸 Captured Active Desktop Screen (Click to enlarge)</div>
    `;
    bubble.appendChild(imgWrapper);
  }

  const content = document.createElement('div');
  content.className = 'chat-bubble-content';
  content.innerHTML = renderMarkdown(text);
  bubble.appendChild(content);

  if (role === 'assistant') {
    const metaBar = document.createElement('div');
    metaBar.className = 'chat-bubble-meta';

    const modelLabel = document.createElement('span');
    modelLabel.textContent = meta.model ? (state.modelDisplayNames[meta.model] || meta.model) : 'VEDAS Core';

    const tools = document.createElement('div');
    tools.className = 'chat-bubble-tools';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'bubble-tool-btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', '📋');
    };

    const speakBtn = document.createElement('button');
    speakBtn.className = 'bubble-tool-btn';
    speakBtn.textContent = '🔊 Listen';
    speakBtn.onclick = () => smartSpeakResponse(text);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'bubble-tool-btn bubble-stop-btn';
    stopBtn.textContent = '⏹️ Stop';
    stopBtn.title = 'Stop speech output / generation';
    stopBtn.onclick = () => stopAllAIResponse();

    tools.appendChild(copyBtn);
    tools.appendChild(speakBtn);
    tools.appendChild(stopBtn);
    metaBar.appendChild(modelLabel);
    metaBar.appendChild(tools);
    bubble.appendChild(metaBar);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessagesContainer.appendChild(row);

  const stage = document.getElementById('chat-stage-body');
  if (stage) stage.scrollTop = stage.scrollHeight;
}

function addThinkingBubble(id) {
  if (!chatMessagesContainer) return;
  const row = document.createElement('div');
  row.className = 'chat-message-row ai-row';
  row.id = id;

  row.innerHTML = `
    <div class="chat-avatar">⚡</div>
    <div class="chat-bubble">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; color:var(--blue-primary); font-size:0.85rem;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status-dot dot-green"></span>
          <span>Synthesizing neural intelligence...</span>
        </div>
        <button class="bubble-tool-btn bubble-stop-btn" onclick="stopAllAIResponse()" style="margin:0; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; padding:3px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;">
          ⏹️ Stop
        </button>
      </div>
    </div>
  `;
  chatMessagesContainer.appendChild(row);
  const stage = document.getElementById('chat-stage-body');
  if (stage) stage.scrollTop = stage.scrollHeight;
}

function removeThinkingBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ==============================================================================
// SCREEN VISION ENGINE (PHASE 1)
// ==============================================================================
window.triggerScreenVision = async function(customPrompt) {
  showToast('📸 Capturing active desktop screen for AI Vision analysis...', 'info');
  switchView('chat');

  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) chatMessagesContainer.style.display = 'flex';

  const prompt = customPrompt || "Analyze what is currently open on my screen. Detail any errors, active windows, key information, and suggested actions.";
  
  // Append user message
  addMessageBubble('user', `📸 [Screen Vision Request]\n${prompt}`, {});

  const thinkingId = 'thinking-' + Date.now();
  addThinkingBubble(thinkingId);
  setGeneratingState(true);

  // Animate waveform
  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('thinking');
  const holoStatus = document.getElementById('holo-status-text');
  if (holoStatus) holoStatus.textContent = 'VISION SCANNING...';

  if (window.activeChatAbortController) {
    try { window.activeChatAbortController.abort(); } catch (e) {}
  }
  window.activeChatAbortController = new AbortController();

  try {
    const res = await fetch('/api/screen-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        model: (modelSelector && modelSelector.value.includes('gemini')) ? modelSelector.value : 'gemini-3.7-flash'
      }),
      signal: window.activeChatAbortController.signal
    });

    window.activeChatAbortController = null;
    removeThinkingBubble(thinkingId);
    setGeneratingState(false);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Create thumbnail attachment
    const attachments = data.image_data ? [{
      name: `Active Screen (${data.dimensions || 'Desktop'})`,
      type: 'image/jpeg',
      data: data.image_data
    }] : [];

    addMessageBubble('assistant', data.analysis, {
      attachments: attachments,
      model: data.model || 'Screen Vision (Gemini)',
      source: 'screen_vision'
    });

    if (state.speechSynthEnabled && data.analysis) {
      smartSpeakResponse(data.analysis.slice(0, 300));
    }
    if (holoStatus) holoStatus.textContent = 'VISION COMPLETE';
    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
    showToast('Screen Vision analysis complete!', 'success');
  } catch (err) {
    window.activeChatAbortController = null;
    removeThinkingBubble(thinkingId);
    setGeneratingState(false);
    if (err.name === 'AbortError') {
      addMessageBubble('assistant', '⏹️ *Screen Vision stopped by user.*', { isStopped: true });
    } else {
      addMessageBubble('assistant', `⚠️ **Screen Vision Notice**: ${err.message}.`, { isError: true });
    }
    if (holoStatus) holoStatus.textContent = 'CORE SYNCHRONIZED';
    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
    showToast(`Screen Vision Notice: ${err.message}`, 'error');
  }
};

// ==============================================================================
// DOCK MODE SWAP (VOICE <-> TYPING) & FAST LIVE WEB SEARCH TOGGLE
// ==============================================================================
window.setDockMode = function(mode) {
  const voiceBar = document.getElementById('dock-voice-mode');
  const typingBar = document.getElementById('dock-typing-mode');
  if (!voiceBar || !typingBar) return;

  if (mode === 'type') {
    voiceBar.style.display = 'none';
    typingBar.style.display = 'flex';
    const input = typingBar.querySelector('#chat-input') || document.getElementById('chat-input');
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  } else {
    typingBar.style.display = 'none';
    voiceBar.style.display = 'flex';
  }
};

window.applyTheme = function(themeName) {
  const themeKey = themeName || 'blue_orange';
  state.currentTheme = themeKey;
  const theme = THEME_PRESETS[themeKey] || THEME_PRESETS['blue_orange'];
  const root = document.documentElement;
  for (const [prop, val] of Object.entries(theme)) {
    root.style.setProperty(prop, val);
  }

  try {
    localStorage.setItem('vedas_theme', themeKey);
  } catch (e) {}

  const select = document.getElementById('setting-theme-palette');
  if (select && select.value !== themeKey) {
    select.value = themeKey;
  }

  if (window.vedasParticles && typeof window.vedasParticles.setColor === 'function') {
    window.vedasParticles.setColor(theme['--blue-primary'], theme['--orange-primary']);
  }
};

window.toggleWebSearch = function(btn) {
  state.useWebSearch = !state.useWebSearch;
  const toggleBtns = document.querySelectorAll('#web-search-toggle, .dock-btn-search');
  toggleBtns.forEach(b => {
    if (state.useWebSearch) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  if (state.useWebSearch) {
    showToast('🌐 Live Web Search: ENABLED (Real-time Google News & Web Intel)', 'info');
  } else {
    showToast('🌐 Live Web Search: DISABLED (Fast Offline Inference)', 'info');
  }
};

window.triggerQuickWebSearch = function(customQuery) {
  state.useWebSearch = true;
  const toggleBtns = document.querySelectorAll('#web-search-toggle, .dock-btn-search');
  toggleBtns.forEach(b => b.classList.add('active'));
  
  const query = customQuery || 'Search and summarize top artificial intelligence & science breakthroughs';
  if (chatInput) chatInput.value = query;
  switchView('chat');
  handleSendMessage();
};

// ==============================================================================
// VOICE & SPEECH SYNTHESIS ENGINE (Centered Mic, Waveform on Top, Silence Buffer)
// ==============================================================================
let recognition = null;
let synth = window.speechSynthesis;
let voiceSilenceTimer = null;
let accumulatedVoiceText = '';

function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      state.isListening = true;
      accumulatedVoiceText = '';
      if (micBtn) micBtn.style.background = 'rgba(239, 68, 68, 0.4)';
      const chatMic = document.getElementById('chat-mic-orb-btn');
      if (chatMic) chatMic.classList.add('recording');
      
      const chatTr = document.getElementById('chat-voice-transcript');
      if (chatTr) {
        chatTr.textContent = 'Listening to your voice...';
        chatTr.className = 'dock-voice-caption active-speech';
      }
      
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('listening');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('listening');
    };

    recognition.onresult = (event) => {
      if (voiceSilenceTimer) {
        clearTimeout(voiceSilenceTimer);
        voiceSilenceTimer = null;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript + ' ';
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      accumulatedVoiceText = (finalTranscript + interimTranscript).trim();

      const chatTr = document.getElementById('chat-voice-transcript');
      if (chatTr && accumulatedVoiceText) {
        // Clean display text without surrounding quotes
        chatTr.textContent = accumulatedVoiceText;
        chatTr.className = 'dock-voice-caption active-speech';
      }

      // Human pause buffer: wait 2.8s of silence before auto-finalizing & sending query
      voiceSilenceTimer = setTimeout(() => {
        if (accumulatedVoiceText && accumulatedVoiceText.trim()) {
          handleVoiceQueryComplete(accumulatedVoiceText);
        }
      }, 2800);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('Speech Recognition Notice:', event.error);
      }
    };

    recognition.onend = () => {
      if (state.isListening) {
        // If still flagged as listening and we have text, finalize
        if (accumulatedVoiceText && accumulatedVoiceText.trim()) {
          handleVoiceQueryComplete(accumulatedVoiceText);
        } else {
          stopVoiceListening();
        }
      }
    };
  }
}

window.toggleVoiceListening = function() {
  if (state.isSpeaking || state.isMicLocked || (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending))) {
    showToast('🔒 Microphone is locked while AI is speaking. Click Stop to interrupt.', '🔒');
    return;
  }

  if (!recognition) {
    showToast('Speech recognition not supported in this browser.', '⚠️');
    return;
  }

  if (state.isListening) {
    if (voiceSilenceTimer) {
      clearTimeout(voiceSilenceTimer);
      voiceSilenceTimer = null;
    }
    if (accumulatedVoiceText && accumulatedVoiceText.trim()) {
      handleVoiceQueryComplete(accumulatedVoiceText);
    } else {
      try { recognition.stop(); } catch (e) {}
      stopVoiceListening();
    }
  } else {
    accumulatedVoiceText = '';
    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start exception:', e);
      stopVoiceListening();
    }
  }
};

function stopVoiceListening() {
  state.isListening = false;
  if (voiceSilenceTimer) {
    clearTimeout(voiceSilenceTimer);
    voiceSilenceTimer = null;
  }
  
  try { recognition && recognition.stop(); } catch (e) {}

  if (micBtn) micBtn.style.background = '';
  const chatMic = document.getElementById('chat-mic-orb-btn');
  if (chatMic && !state.isMicLocked) chatMic.classList.remove('recording');
  
  const chatTr = document.getElementById('chat-voice-transcript');
  if (chatTr && !state.isMicLocked) {
    chatTr.textContent = 'Click the orb or press Ctrl+M to talk';
    chatTr.className = 'dock-voice-caption';
  }
  
  if (window.vedasChatWaveform && !state.isSpeaking) window.vedasChatWaveform.setState('idle');
  if (window.vedasDashWaveform && !state.isSpeaking) window.vedasDashWaveform.setState('idle');
}

function handleVoiceQueryComplete(text) {
  stopVoiceListening();
  if (!text || !text.trim()) return;
  
  const clean = text.trim();
  // Voice Command Routing
  if (/look at (?:my )?screen|what(?:'s| is) on my screen|analyze screen|screen vision|screenshot this/i.test(clean)) {
    triggerScreenVision(clean);
    return;
  }

  if (chatInput) chatInput.value = clean;
  switchView('chat');
  handleSendMessage();
}

let currentSpeechContext = {
  fullText: '',
  cleanText: '',
  initialChunk: '',
  remainingChunk: '',
  isReadingFull: false
};

let vrfAutoDismissTimer = null;

function smartSpeakResponse(text, isFullRequested = false) {
  if (!synth) return;
  synth.cancel();

  const clean = text
    .replace(/```[\s\S]*?```/g, 'Code snippet omitted.')
    .replace(/[*#`_\[\]()]/g, '')
    .trim();

  if (!clean) return;

  currentSpeechContext = {
    fullText: text,
    cleanText: clean,
    initialChunk: '',
    remainingChunk: '',
    isReadingFull: isFullRequested
  };

  if (vrfAutoDismissTimer) {
    clearTimeout(vrfAutoDismissTimer);
    vrfAutoDismissTimer = null;
  }

  // If user explicitly asked for full read or message is very short
  if (isFullRequested || clean.length <= 130) {
    speakFullUtterance(clean);
    return;
  }

  // Calculate the first ~25% chunk at natural sentence/phrase boundaries
  const targetLen = Math.max(70, Math.floor(clean.length * 0.25));
  let splitIndex = -1;

  const minSearch = Math.floor(targetLen * 0.7);
  const maxSearch = Math.min(clean.length, Math.floor(targetLen * 1.5));
  
  for (let i = minSearch; i < maxSearch; i++) {
    if (['.', '?', '!', '\n'].includes(clean[i])) {
      splitIndex = i + 1;
      break;
    }
  }

  if (splitIndex === -1) {
    for (let i = minSearch; i < maxSearch; i++) {
      if ([',', ';', ' '].includes(clean[i])) {
        splitIndex = i + 1;
        break;
      }
    }
  }

  if (splitIndex === -1 || splitIndex >= clean.length) {
    splitIndex = Math.min(clean.length, targetLen);
  }

  const initialChunk = clean.slice(0, splitIndex).trim();
  const remainingChunk = clean.slice(splitIndex).trim();

  currentSpeechContext.initialChunk = initialChunk;
  currentSpeechContext.remainingChunk = remainingChunk;

  speakInitialChunk(initialChunk);
}

function speakInitialChunk(chunkText) {
  if (!synth) return;
  synth.cancel();

  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('speaking');
  if (window.vedasDashWaveform) window.vedasDashWaveform.setState('speaking');
  setSpeakingState(true);

  const chatTr = document.getElementById('chat-voice-transcript');
  if (chatTr) {
    chatTr.textContent = '🔊 Reading response preview... (Mic locked)';
    chatTr.className = 'dock-voice-caption speaking';
  }

  const utter = new SpeechSynthesisUtterance(chunkText);
  utter.rate = 1.05;
  utter.pitch = 1.0;

  utter.onend = () => {
    if (!currentSpeechContext.isReadingFull) {
      setSpeakingState(false);
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');

      // Now that the ~25% preview has finished being read, pop up the prompt at the bottom!
      showReadFullPrompt();

      // Auto dismiss prompt after 15s if user takes no action
      vrfAutoDismissTimer = setTimeout(() => {
        dismissReadFullPrompt(false);
      }, 15000);
    }
  };

  utter.onerror = () => {
    if (!currentSpeechContext.isReadingFull) {
      setSpeakingState(false);
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
    }
  };

  synth.speak(utter);
}

function speakFullUtterance(fullCleanText) {
  if (!synth) return;
  synth.cancel();

  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('speaking');
  if (window.vedasDashWaveform) window.vedasDashWaveform.setState('speaking');
  setSpeakingState(true);

  const chatTr = document.getElementById('chat-voice-transcript');
  if (chatTr) {
    chatTr.textContent = '🔊 Reading complete response... (Mic locked)';
    chatTr.className = 'dock-voice-caption speaking';
  }

  const sentences = fullCleanText.match(/[^.!?\n]+[.!?\n]+/g) || [fullCleanText];
  let idx = 0;

  function speakNextSentence() {
    if (idx >= sentences.length || !state.isSpeaking) {
      setSpeakingState(false);
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
      dismissReadFullPrompt(false);
      return;
    }

    const sUtter = new SpeechSynthesisUtterance(sentences[idx].trim());
    sUtter.rate = 1.05;
    sUtter.pitch = 1.0;

    sUtter.onend = () => {
      idx++;
      speakNextSentence();
    };

    sUtter.onerror = () => {
      setSpeakingState(false);
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
      dismissReadFullPrompt(false);
    };

    synth.speak(sUtter);
  }

  speakNextSentence();
}

window.readFullResponseSpeech = function() {
  if (!currentSpeechContext.cleanText) return;
  currentSpeechContext.isReadingFull = true;

  if (vrfAutoDismissTimer) {
    clearTimeout(vrfAutoDismissTimer);
    vrfAutoDismissTimer = null;
  }

  const panel = document.getElementById('voice-read-full-panel');
  if (panel) {
    const title = document.getElementById('vrf-title');
    if (title) title.textContent = '🔊 Reading Full Response...';
    const chip = document.getElementById('vrf-progress-chip');
    if (chip) chip.textContent = 'Full Audio';
    const yesBtn = document.getElementById('vrf-btn-yes');
    if (yesBtn) yesBtn.style.display = 'none';
  }

  const textToRead = currentSpeechContext.remainingChunk || currentSpeechContext.cleanText;
  speakFullUtterance(textToRead);
};

window.dismissReadFullPrompt = function(shouldStopAudio = false) {
  if (vrfAutoDismissTimer) {
    clearTimeout(vrfAutoDismissTimer);
    vrfAutoDismissTimer = null;
  }

  if (shouldStopAudio) {
    stopAllAIResponse();
  }

  const panel = document.getElementById('voice-read-full-panel');
  if (panel) {
    panel.classList.add('closing');
    setTimeout(() => {
      panel.style.display = 'none';
      panel.classList.remove('closing');
      const yesBtn = document.getElementById('vrf-btn-yes');
      if (yesBtn) yesBtn.style.display = 'inline-flex';
      const title = document.getElementById('vrf-title');
      if (title) title.textContent = 'Should I read it to you in full?';
      const chip = document.getElementById('vrf-progress-chip');
      if (chip) chip.textContent = '25% Preview';
    }, 250);
  }
};

function showReadFullPrompt() {
  const panel = document.getElementById('voice-read-full-panel');
  if (!panel) return;

  const title = document.getElementById('vrf-title');
  if (title) title.textContent = 'Should I read it to you in full?';
  const chip = document.getElementById('vrf-progress-chip');
  if (chip) chip.textContent = '25% Preview';
  const yesBtn = document.getElementById('vrf-btn-yes');
  if (yesBtn) yesBtn.style.display = 'inline-flex';

  panel.classList.remove('closing');
  panel.style.display = 'flex';
}

// ==============================================================================
// SETTINGS CONTROLLER
// ==============================================================================
window.switchSettingsSubTab = function(tabName) {
  const tabs = document.querySelectorAll('.settings-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  const activeBtn = document.getElementById(`set-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const panels = document.querySelectorAll('.settings-panel');
  panels.forEach(p => p.style.display = 'none');
  const targetPanel = document.getElementById(`settings-panel-${tabName}`);
  if (targetPanel) targetPanel.style.display = 'flex';
};

window.toggleKeyVisibility = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = (input.type === 'password') ? 'text' : 'password';
};

async function loadSettingsFromServer() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.checked = !!val;
    };

    setVal('setting-ollama-host', cfg.ollama_host || 'http://127.0.0.1:11434');
    setVal('setting-local-model', cfg.local_model || 'llama3.2:latest');
    setVal('setting-cloud-model', cfg.cloud_model || 'gemini-3.7-flash');
    setChecked('setting-supervisor-toggle', cfg.supervisor_enabled !== false);
    setVal('setting-temp-slider', cfg.temperature || 0.7);
    const tempVal = document.getElementById('temp-val');
    if (tempVal) tempVal.textContent = cfg.temperature || 0.7;

    setVal('setting-tts-engine', cfg.tts_engine || 'webspeech');
    setVal('setting-speech-rate', cfg.speech_rate || 1.0);
    const rateVal = document.getElementById('rate-val');
    if (rateVal) rateVal.textContent = (cfg.speech_rate || 1.0) + 'x';

    setChecked('setting-autospeak-toggle', cfg.speechSynthEnabled !== false);
    const activeTheme = cfg.theme_glow || 'blue_orange';
    setVal('setting-theme-palette', activeTheme);
    setChecked('setting-particles-toggle', cfg.particles !== false);

    // Apply aesthetics & glow immediately
    if (window.applyTheme) window.applyTheme(activeTheme);

    if (cfg.local_model) state.activeModel = cfg.local_model;
    if (modelSelector && cfg.local_model) modelSelector.value = cfg.local_model;
  } catch (e) {}
}

window.saveAllSettings = async function() {
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const getChecked = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

  const themeGlowVal = getVal('setting-theme-palette') || 'blue_orange';

  const payload = {
    ollama_host: getVal('setting-ollama-host').trim(),
    local_model: getVal('setting-local-model'),
    cloud_model: getVal('setting-cloud-model'),
    supervisor_enabled: getChecked('setting-supervisor-toggle'),
    temperature: parseFloat(getVal('setting-temp-slider')) || 0.7,
    tts_engine: getVal('setting-tts-engine'),
    speech_rate: parseFloat(getVal('setting-speech-rate')) || 1.0,
    speechSynthEnabled: getChecked('setting-autospeak-toggle'),
    theme_glow: themeGlowVal
  };

  // Apply theme immediately to UI
  if (window.applyTheme) {
    window.applyTheme(themeGlowVal);
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      state.activeModel = payload.local_model;
      if (modelSelector) modelSelector.value = payload.local_model;
      const hint = document.getElementById('settings-saved-hint');
      if (hint) {
        hint.textContent = '✓ Settings saved & theme applied!';
        setTimeout(() => hint.textContent = '', 3500);
      }
      showToast('Settings saved & glowing theme applied!', '✅');
      fetchSystemStatus();
    }
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, '⚠️');
  }
};

window.exportFullBackup = function() {
  const backup = { sessions: state.sessions, memoryNotes: state.memoryNotes, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vedas_ai_backup_${Date.now()}.json`;
  a.click();
  showToast('Backup JSON downloaded!', '💾');
};

// ==============================================================================
// IMAGE STUDIO
// ==============================================================================
window.executeImageGeneration = async function() {
  const promptInput = document.getElementById('image-prompt-input');
  const styleSelect = document.getElementById('image-style-select');
  const ratioSelect = document.getElementById('image-ratio-select');
  const previewBox = document.getElementById('image-preview-box');
  const btn = document.getElementById('image-gen-btn');

  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please enter an image description.', '⚠️');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Synthesizing 8K Render...';
  }

  if (previewBox) {
    previewBox.innerHTML = `
      <div class="image-placeholder-content" id="img-loading-indicator">
        <div class="ph-icon" style="animation: pulseGlow 1.5s infinite alternate;">✨</div>
        <div class="ph-title" style="color:var(--orange-primary);">Synthesizing 8K Neural Render...</div>
        <div class="ph-desc">Generating photorealistic diffusion texture and cyber reflections...</div>
      </div>
    `;
  }

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        style: styleSelect ? styleSelect.value : 'cinematic',
        aspect_ratio: ratioSelect ? ratioSelect.value : '1:1'
      })
    });
    const data = await res.json();
    const src = data.data_uri || data.url;
    if (src && previewBox) {
      previewBox.innerHTML = `
        <div class="image-preview-wrapper">
          <div class="image-placeholder-content" id="img-stream-loader" style="margin-bottom:12px;">
            <div class="ph-icon" style="font-size:2.4rem;">⏳</div>
            <div class="ph-title" style="color:var(--blue-primary); font-size:1rem;">Streaming Render Stream...</div>
            <div class="ph-desc" style="font-size:0.8rem;">Resolving 8K pixel layers from neural cluster...</div>
          </div>
          <img id="rendered-studio-img" src="${src}" alt="Render" style="display:none; max-height:calc(100vh - 280px); max-width:100%; border-radius:12px; border:1px solid var(--border-glass); box-shadow:0 16px 48px rgba(0,0,0,0.8); cursor:pointer;" onload="const l=document.getElementById('img-stream-loader'); if(l)l.style.display='none'; this.style.display='block'; const b=document.getElementById('img-action-toolbar'); if(b)b.style.display='flex';" onclick="openLightbox('${src}')" />
          <div id="img-action-toolbar" style="display:none; margin-top:14px; gap:12px; align-items:center; justify-content:center;">
            <a href="${src}" download="vedas_8k_render.jpg" target="_blank" class="studio-generate-btn" style="width:auto; padding:8px 22px; text-decoration:none; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">💾 Download 8K Image</a>
            <button class="tag-chip" onclick="openLightbox('${src}')" style="font-size:0.82rem; padding:8px 16px;">🔍 Fullscreen Inspect</button>
          </div>
        </div>
      `;
      showToast('8K Render synthesizing live!', '🎨');
    }
  } catch (err) {
    if (previewBox) previewBox.innerHTML = `<div class="image-placeholder-content"><div class="ph-icon" style="color:var(--red-crimson);">⚠️</div><div class="ph-title">Error</div><div class="ph-desc">${escapeHtml(err.message)}</div></div>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>✨</span> Generate 8K Image';
    }
  }
};

window.openLightbox = function(src) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (modal && img) {
    img.src = src;
    modal.style.display = 'flex';
  }
};
window.closeLightbox = function() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.style.display = 'none';
};

// ==============================================================================
// SYSTEM COMMAND CENTER (Horizontal Tab Switcher)
// ==============================================================================
window.switchCommandsTab = function(tabName) {
  const tabs = document.querySelectorAll('.cmd-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  const activeBtn = document.getElementById(`cmd-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const panels = document.querySelectorAll('.cmd-tab-panel');
  panels.forEach(p => p.style.display = 'none');
  const targetPanel = document.getElementById(`cmd-panel-${tabName}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
  }
};

// ==============================================================================
// MEMORY BANK
// ==============================================================================
async function loadStoredMemory() {
  try {
    const res = await fetch('/api/memory');
    if (res.ok) {
      const data = await res.json();
      state.memoryNotes = data.notes || [];
      renderMemoryPage();
    }
  } catch (e) {}
}

function renderMemoryPage() {
  const container = document.getElementById('memory-items-container');
  if (!container) return;
  if (state.memoryNotes.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No stored memories yet.</div>';
    return;
  }
  container.innerHTML = state.memoryNotes.map((n, idx) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; margin-bottom:6px;">
      <span>${escapeHtml(n)}</span>
      <button onclick="deleteMemoryNote(${idx})" style="background:none; border:none; color:var(--red-crimson); cursor:pointer;">✕</button>
    </div>
  `).join('');
}

window.addCustomMemoryNote = async function() {
  const input = document.getElementById('memory-new-input');
  const note = input ? input.value.trim() : '';
  if (!note) return;
  try {
    await fetch('/api/memory/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    input.value = '';
    await loadStoredMemory();
    showToast('Fact memorized!', '🧠');
  } catch (e) {}
};

window.deleteMemoryNote = async function(idx) {
  await fetch(`/api/memory/notes/${idx}`, { method: 'DELETE' });
  await loadStoredMemory();
};

window.clearAllMemoryNotes = async function() {
  if (confirm('Clear all stored memories?')) {
    await fetch('/api/memory/clear', { method: 'DELETE' });
    await loadStoredMemory();
    showToast('Memory cleared', '🧹');
  }
};

// ==============================================================================
// CODEX LAB
// ==============================================================================
function initCodexEditor() {
  const editor = document.getElementById('codex-editor');
  const lineNumbers = document.getElementById('codex-line-numbers');
  if (!editor || !lineNumbers) return;

  function update() {
    const text = editor.value || '';
    const lines = text.split('\n').length || 1;
    let nums = '';
    for (let i = 1; i <= lines; i++) nums += i + '\n';
    lineNumbers.textContent = nums;
    const lEl = document.getElementById('codex-line-count');
    const cEl = document.getElementById('codex-char-count');
    if (lEl) lEl.textContent = `Lines: ${lines}`;
    if (cEl) cEl.textContent = `Chars: ${text.length}`;
  }

  editor.oninput = update;
  editor.onscroll = () => lineNumbers.scrollTop = editor.scrollTop;
  update();
}

window.switchCodexTab = function(tab) {
  ['check', 'fix', 'console'].forEach(t => {
    const btn = document.getElementById(`codex-tab-${t}-btn`);
    const view = document.getElementById(`codex-view-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (view) view.style.display = (t === tab) ? 'block' : 'none';
  });
};

window.loadCodexSample = function() {
  const editor = document.getElementById('codex-editor');
  if (editor) {
    editor.value = `# Sample Python Program with Bugs\ndef divide(a, b):\n    return a / b\n\nprint(divide(10, 0))\n`;
    initCodexEditor();
  }
};

window.clearCodexEditor = function() {
  const editor = document.getElementById('codex-editor');
  if (editor) {
    editor.value = '';
    initCodexEditor();
  }
};

window.copyCodexEditorCode = function() {
  const editor = document.getElementById('codex-editor');
  if (editor && editor.value) {
    navigator.clipboard.writeText(editor.value);
    showToast('Code copied!', '📋');
  }
};

window.checkCodexCode = async function() {
  const editor = document.getElementById('codex-editor');
  const reportBox = document.getElementById('codex-report-box');
  const langSelect = document.getElementById('codex-lang-select');
  const modelSelect = document.getElementById('codex-model-select');
  const statusPill = document.getElementById('codex-status-pill');
  const code = editor ? editor.value.trim() : '';
  if (!code) {
    showToast('Please enter some code to inspect.', '⚠️');
    return;
  }

  switchCodexTab('check');
  if (statusPill) { statusPill.className = 'codex-status-pill running'; statusPill.textContent = 'Analyzing...'; }
  if (reportBox) reportBox.innerHTML = '<div style="color:var(--blue-primary); font-weight:600;">⚡ Scanning AST syntax tree & running neural security audit...</div>';

  try {
    const res = await fetch('/api/codex/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        language: langSelect ? langSelect.value : 'python',
        model: modelSelect ? modelSelect.value : 'gemini-3.7-flash'
      })
    });
    const data = await res.json();
    if (statusPill) {
      statusPill.className = data.valid ? 'codex-status-pill success' : 'codex-status-pill error';
      statusPill.textContent = data.valid ? 'Verified' : 'Issues Found';
    }
    if (reportBox) reportBox.innerHTML = renderMarkdown(data.analysis || 'Analysis complete.');
  } catch (err) {
    if (statusPill) { statusPill.className = 'codex-status-pill error'; statusPill.textContent = 'Error'; }
    if (reportBox) reportBox.innerHTML = `<div style="color:var(--red-crimson);">Error: ${err.message}</div>`;
  }
};

window.fixCodexCode = async function() {
  const editor = document.getElementById('codex-editor');
  const fixBox = document.getElementById('codex-fix-box');
  const langSelect = document.getElementById('codex-lang-select');
  const modelSelect = document.getElementById('codex-model-select');
  const statusPill = document.getElementById('codex-status-pill');
  const code = editor ? editor.value.trim() : '';
  if (!code) {
    showToast('Please enter some code to fix.', '⚠️');
    return;
  }

  switchCodexTab('fix');
  if (statusPill) { statusPill.className = 'codex-status-pill running'; statusPill.textContent = 'Repairing...'; }
  if (fixBox) fixBox.innerHTML = '<div style="color:var(--orange-primary); font-weight:600;">🛠️ AI Auto-Repairing code flaws and reconstructing syntax...</div>';

  try {
    const res = await fetch('/api/codex/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        language: langSelect ? langSelect.value : 'python',
        model: modelSelect ? modelSelect.value : 'gemini-3.7-flash'
      })
    });
    const data = await res.json();
    if (statusPill) { statusPill.className = 'codex-status-pill success'; statusPill.textContent = 'Repaired'; }
    if (fixBox) {
      const fixedCode = data.fixed_code || '';
      window._lastCodexFix = fixedCode;
      fixBox.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
          <span style="font-weight:800; color:var(--green-emerald);">✨ Auto-Repaired Code</span>
          <button class="codex-btn codex-btn-run" onclick="applyCodexFix()" style="font-size:0.75rem;">⚡ Apply Fix to Editor</button>
        </div>
        <pre style="background:#020617; border:1px solid rgba(0,210,255,0.2); padding:12px; border-radius:6px; font-family:var(--font-mono); font-size:0.84rem; overflow-x:auto;"><code>${escapeHtml(fixedCode)}</code></pre>
        <div style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">${renderMarkdown(data.explanation || '')}</div>
      `;
    }
  } catch (err) {
    if (statusPill) { statusPill.className = 'codex-status-pill error'; statusPill.textContent = 'Error'; }
    if (fixBox) fixBox.innerHTML = `<div style="color:var(--red-crimson);">Fix Error: ${err.message}</div>`;
  }
};

window.applyCodexFix = function() {
  const editor = document.getElementById('codex-editor');
  if (editor && window._lastCodexFix) {
    editor.value = window._lastCodexFix;
    initCodexEditor();
    showToast('Fixed code applied to editor!', '🛠️');
  }
};

window.runCodexCode = async function() {
  const editor = document.getElementById('codex-editor');
  const consoleBox = document.getElementById('codex-console-output');
  const code = editor ? editor.value.trim() : '';
  if (!code) return;

  switchCodexTab('console');
  if (consoleBox) consoleBox.textContent = '$ Running sandbox...';

  try {
    const res = await fetch('/api/execute-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (consoleBox) consoleBox.textContent = data.stdout || data.stderr || 'Execution finished with no output.';
  } catch (err) {
    if (consoleBox) consoleBox.textContent = `Error: ${err.message}`;
  }
};

// ==============================================================================
// IMAGE STUDIO INSPIRATION HELPER
// ==============================================================================
window.setImagePrompt = function(promptText) {
  const input = document.getElementById('image-prompt-input');
  if (input) {
    input.value = promptText;
    input.focus();
    showToast('Inspiration prompt loaded!', '✨');
  }
};

// ==============================================================================
// FILE EXPLORER
// ==============================================================================
let currentBrowsePath = null;
let cachedFilesList = [];

async function loadFilesBrowser(targetPath = null) {
  try {
    const res = await fetch('/api/files/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    });
    if (!res.ok) return;
    const data = await res.json();
    currentBrowsePath = data.current_path;
    cachedFilesList = data.items || [];

    const pathBar = document.getElementById('files-current-path');
    if (pathBar) pathBar.textContent = data.current_path;

    renderFilesTree(cachedFilesList);
  } catch (e) {}
}

function renderFilesTree(items) {
  const treeList = document.getElementById('files-tree-list');
  if (!treeList) return;
  if (!items || items.length === 0) {
    treeList.innerHTML = '<div style="color:var(--text-dim); font-size:0.8rem; padding:10px;">No files found.</div>';
    return;
  }
  treeList.innerHTML = items.map(item => `
    <div class="file-tree-item" onclick="${item.is_dir ? `loadFilesBrowser('${item.path.replace(/\\/g, '\\\\')}')` : `openFileInViewer('${item.path.replace(/\\/g, '\\\\')}')`}">
      <span class="file-tree-name">
        <span>${item.is_dir ? '📁' : getFileIcon(item.name)}</span>
        <span>${escapeHtml(item.name)}</span>
      </span>
      <span class="file-tree-meta">${item.is_dir ? 'Dir' : formatBytes(item.size)}</span>
    </div>
  `).join('');
}

function getFileIcon(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.py')) return '🐍';
  if (n.endsWith('.js') || n.endsWith('.ts')) return '🟨';
  if (n.endsWith('.html') || n.endsWith('.css')) return '🌐';
  if (n.endsWith('.json')) return '📦';
  if (n.endsWith('.md')) return '📝';
  if (n.endsWith('.pdf')) return '📑';
  if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp')) return '🖼️';
  return '📄';
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

window.filterFilesList = function(query) {
  const q = (query || '').toLowerCase().trim();
  const filtered = q ? cachedFilesList.filter(item => item.name.toLowerCase().includes(q)) : cachedFilesList;
  renderFilesTree(filtered);
};

window.navigateFileUp = function() {
  if (currentBrowsePath) {
    const parts = currentBrowsePath.split(/[\\\/]/);
    if (parts.length > 1) {
      parts.pop();
      loadFilesBrowser(parts.join('\\'));
    }
  }
};

window.refreshFileList = function() {
  loadFilesBrowser(currentBrowsePath);
  showToast('File list refreshed', '🔄');
};

window.openFileInViewer = async function(filePath) {
  const viewer = document.getElementById('files-viewer-box');
  if (!viewer) return;
  try {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    viewer.innerHTML = `
      <div style="font-weight:700; margin-bottom:8px; color:var(--blue-bright);">${escapeHtml(data.name)}</div>
      <pre style="background:#020617; padding:12px; border-radius:6px; max-height:400px; overflow:auto;"><code>${escapeHtml(data.content)}</code></pre>
    `;
  } catch (err) {
    viewer.innerHTML = `Failed to load: ${err.message}`;
  }
};

// ==============================================================================
// SYSTEM COMMANDS
// ==============================================================================
window.runSysCmd = async function(cmd) {
  showToast(`Executing: ${cmd}...`, '⚡');
  try {
    const res = await fetch('/api/system/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    showToast(data.message || 'Action finished.', data.success ? '✅' : '⚠️');
  } catch (err) {
    showToast('Error: ' + err.message, '❌');
  }
};

window.confirmShutdown = function() {
  const m = document.getElementById('shutdown-confirm-modal');
  if (m) m.style.display = 'flex';
};
window.closeShutdownModal = function() {
  const m = document.getElementById('shutdown-confirm-modal');
  if (m) m.style.display = 'none';
};
window.executeShutdown = function() {
  closeShutdownModal();
  runSysCmd('shutdown');
};

window.confirmRestart = function() {
  const m = document.getElementById('restart-confirm-modal');
  if (m) m.style.display = 'flex';
};
window.closeRestartModal = function() {
  const m = document.getElementById('restart-confirm-modal');
  if (m) m.style.display = 'none';
};
window.executeRestart = function() {
  closeRestartModal();
  runSysCmd('restart');
};

// ==============================================================================
// TELEMETRY & SESSIONS
// ==============================================================================
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/system/status');
    if (!res.ok) return;
    const data = await res.json();
    state.systemStatus = data;

    const ollamaModelEl = document.getElementById('home-ollama-model');
    const geminiModelEl = document.getElementById('home-gemini-model');
    const cpuText = document.getElementById('home-cpu-text');
    const cpuBar = document.getElementById('home-cpu-bar');
    const ramText = document.getElementById('home-ram-text');
    const ramBar = document.getElementById('home-ram-bar');

    if (ollamaModelEl) ollamaModelEl.textContent = state.modelDisplayNames[data.active_local_model] || data.active_local_model;
    if (geminiModelEl) geminiModelEl.textContent = state.modelDisplayNames[data.active_cloud_model] || data.active_cloud_model;
    if (cpuText) cpuText.textContent = `CPU: ${data.cpu_usage || 0}%`;
    if (cpuBar) cpuBar.style.width = `${Math.min(100, Math.max(5, data.cpu_usage || 0))}%`;
    if (ramText) ramText.textContent = `RAM: ${data.ram_usage || 0}%`;
    if (ramBar) ramBar.style.width = `${Math.min(100, Math.max(5, data.ram_usage || 0))}%`;

    const sbCpu = document.getElementById('sidebar-cpu-val');
    const sbRam = document.getElementById('sidebar-ram-val');
    if (sbCpu) sbCpu.textContent = `CPU: ${data.cpu_usage || 0}%`;
    if (sbRam) sbRam.textContent = `RAM: ${data.ram_usage || 0}%`;
  } catch (e) {}
}

window.restartOllamaService = async function() {
  showToast('Connecting / restarting Ollama...', '⚡');
  try {
    const res = await fetch('/api/ollama/start', { method: 'POST' });
    const data = await res.json();
    showToast(data.running ? 'Ollama online!' : 'Daemon checked.', '⚡');
    fetchSystemStatus();
  } catch (e) {}
};

async function loadStoredSessions() {
  try {
    const res = await fetch('/api/memory');
    if (res.ok) {
      const data = await res.json();
      state.sessions = data.sessions || [];
      renderSessionsList();
    }
  } catch (e) {}
}

function renderSessionsList() {
  if (!sessionsList) return;
  if (state.sessions.length === 0) {
    sessionsList.innerHTML = `<div style="font-size:0.75rem; color:var(--text-dim); padding:6px 4px; font-style:italic;">No recent chats</div>`;
    return;
  }
  sessionsList.innerHTML = state.sessions.slice(0, 15).map(s => `
    <div class="history-session-item ${s.id === state.currentSessionId ? 'active' : ''}" onclick="loadSession('${s.id}')">
      <span class="history-session-title">${escapeHtml(s.title || 'Conversation')}</span>
      <button class="history-session-del" onclick="event.stopPropagation(); deleteSession('${s.id}')">✕</button>
    </div>
  `).join('');
}

window.startNewChat = function() {
  state.currentSessionId = 'session_' + Date.now();
  if (chatMessagesContainer) {
    chatMessagesContainer.innerHTML = '';
    chatMessagesContainer.style.display = 'none';
  }
  if (welcomeHero) welcomeHero.style.display = 'block';
  switchView('chat');
  showToast('Started new conversation', '✨');
};

window.clearCurrentChatMessages = function() {
  if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
  if (welcomeHero) welcomeHero.style.display = 'block';
  showToast('Chat cleared', '🧹');
};

window.clearAllSessions = function() {
  if (confirm('Clear all conversation history?')) {
    state.sessions = [];
    renderSessionsList();
    window.startNewChat();
  }
};

window.deleteSession = async function(sId) {
  try {
    await fetch(`/api/sessions/${sId}`, { method: 'DELETE' });
    state.sessions = state.sessions.filter(s => s.id !== sId);
    renderSessionsList();
  } catch (e) {}
};

window.loadSession = function(sId) {
  const session = state.sessions.find(s => s.id === sId);
  if (!session) return;
  state.currentSessionId = sId;
  switchView('chat');
  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) {
    chatMessagesContainer.innerHTML = '';
    chatMessagesContainer.style.display = 'flex';
    (session.messages || []).forEach(m => addMessageBubble(m.role, m.content, m.meta || {}));
  }
  renderSessionsList();
};

async function saveActiveSession() {
  if (!state.currentSessionId) state.currentSessionId = 'session_' + Date.now();
  const bubbles = document.querySelectorAll('.chat-message-row');
  const messages = [];
  bubbles.forEach(b => {
    const isUser = b.classList.contains('user-row');
    const textEl = b.querySelector('.chat-bubble-content');
    if (textEl) messages.push({ role: isUser ? 'user' : 'assistant', content: textEl.innerText });
  });

  const title = messages[0] ? messages[0].content.slice(0, 30) + '...' : 'Conversation';
  const payload = { id: state.currentSessionId, title, messages, updatedAt: new Date().toISOString() };

  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    loadStoredSessions();
  } catch (e) {}
}

// ==============================================================================
// ATTACHMENTS & EVENT LISTENERS
// ==============================================================================
function initEventListeners() {
  if (chatInput) {
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };
  }

  document.querySelectorAll('.quick-card').forEach(card => {
    card.onclick = () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt && chatInput) {
        chatInput.value = prompt;
        switchView('chat');
        handleSendMessage();
      }
    };
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleVoiceListening();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      startNewChat();
    }
  });

  if (fileInput) {
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      for (const f of files) {
        const formData = new FormData();
        formData.append('file', f);
        showToast(`Uploading ${f.name}...`, '📎');
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          state.attachments.push({
            name: f.name,
            type: f.type,
            data: data.data_uri || '',
            text_content: data.text_content || '',
            is_pdf: data.is_pdf || false
          });
          renderAttachmentTray();
          showToast(`Attached ${f.name}`, '✅');
        } catch (err) {
          showToast(`Upload error: ${err.message}`, '⚠️');
        }
      }
    };
  }
}

function renderAttachmentTray() {
  if (!attachmentTray) return;
  if (state.attachments.length === 0) {
    attachmentTray.innerHTML = '';
    attachmentTray.style.display = 'none';
    return;
  }
  attachmentTray.style.display = 'flex';
  attachmentTray.innerHTML = state.attachments.map((att, i) => `
    <span style="background:rgba(0,210,255,0.15); border:1px solid rgba(0,210,255,0.3); padding:3px 8px; border-radius:6px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px;">
      📎 ${escapeHtml(att.name)}
      <button onclick="state.attachments.splice(${i},1); renderAttachmentTray();" style="background:none; border:none; color:#f87171; cursor:pointer;">✕</button>
    </span>
  `).join('');
}

// Markdown Helper
function renderMarkdown(str) {
  if (!str) return '';
  let res = escapeHtml(str);

  res = res.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><div style="display:flex; justify-content:space-between; margin-bottom:6px; color:var(--blue-bright); font-size:0.72rem;"><span>${lang || 'code'}</span><button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText); showToast('Code copied!','📋');" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">📋 Copy</button></div><code>${code}</code></pre>`;
  });

  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  res = res.replace(/^### (.*$)/gim, '<h4 style="margin:8px 0; color:var(--blue-bright);">$1</h4>');
  res = res.replace(/^## (.*$)/gim, '<h3 style="margin:10px 0; color:#fff;">$1</h3>');
  res = res.replace(/^# (.*$)/gim, '<h2 style="margin:12px 0; color:#fff;">$1</h2>');
  res = res.replace(/\n/g, '<br/>');

  return res;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.showToast = function(msg, icon = '⚡') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ==============================================================================
// MASTER DOCK & IN-PLACE VOICE/TYPE SWAPPING (1-LINE SYMMETRICAL DOCK)
// ==============================================================================
window.setDockMode = function(mode) {
  const voiceDock = document.getElementById('dock-voice-mode');
  const typeDock = document.getElementById('dock-typing-mode');

  if (mode === 'type') {
    if (voiceDock) voiceDock.style.display = 'none';
    if (typeDock) {
      typeDock.style.display = 'flex';
      setTimeout(() => {
        const inp = document.getElementById('chat-input');
        if (inp) inp.focus();
      }, 50);
    }
  } else {
    if (typeDock) typeDock.style.display = 'none';
    if (voiceDock) voiceDock.style.display = 'flex';
  }
};

window.toggleWebSearch = function(btn) {
  state.useWebSearch = !state.useWebSearch;
  if (btn) btn.classList.toggle('active', state.useWebSearch);
  const dot = document.getElementById('search-dot');
  if (dot) {
    dot.style.background = state.useWebSearch ? 'var(--green-emerald)' : 'rgba(255,255,255,0.2)';
    dot.style.boxShadow = state.useWebSearch ? '0 0 8px var(--green-emerald)' : 'none';
  }
  showToast(state.useWebSearch ? 'Live Web Search ENABLED 🌐' : 'Live Web Search DISABLED', state.useWebSearch ? '🌐' : '⚡');
};

// ==============================================================================
// REAL-TIME SCREEN VISION (Hardware-Accelerated + Gemini Multimodal Vision)
// ==============================================================================
async function captureBrowserScreen() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
    await new Promise(r => setTimeout(r, 120));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    stream.getTracks().forEach(t => t.stop());
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (err) {
    console.warn('Browser getDisplayMedia cancelled/skipped, falling back to server capture:', err);
    return null;
  }
}

window.triggerScreenVision = async function(customPrompt = null) {
  let promptText = customPrompt;
  if (!promptText && chatInput && chatInput.value.trim()) {
    promptText = chatInput.value.trim();
    chatInput.value = '';
  }
  if (!promptText) {
    promptText = "Analyze this screen in detail. Explain what applications, code, terminal, errors, or content are visible and provide helpful insights.";
  }

  showToast('Capturing active screen with AI Vision... 📸', '📸');
  switchView('chat');

  if (welcomeHero) welcomeHero.style.display = 'none';
  if (chatMessagesContainer) chatMessagesContainer.style.display = 'flex';

  addMessageBubble('user', `📸 [Screen Vision Analysis]: ${promptText}`);

  const thinkingId = 'thinking-screen-' + Date.now();
  addThinkingBubble(thinkingId);

  // Attempt client-side capture first (zero black screen), fallback to server
  let clientImg = null;
  try {
    clientImg = await captureBrowserScreen();
  } catch (e) {}

  try {
    const res = await fetch('/api/screen-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptText,
        image_data: clientImg,
        session_id: state.currentSessionId,
        model: 'gemini-3.7-flash'
      })
    });

    const data = await res.json();
    removeThinkingBubble(thinkingId);

    const reply = data.text || data.analysis || 'Screen vision analysis complete.';
    
    // Pass screenshot preview thumbnail to render in bubble
    const previewSrc = data.image_data || data.preview_data_uri || clientImg;
    const meta = {
      model: data.model || 'Gemini Vision',
      screenshot_preview: previewSrc
    };
    addMessageBubble('assistant', reply, meta);

    if (state.speechSynthEnabled) {
      smartSpeakResponse(reply);
    }
    saveActiveSession();
  } catch (err) {
    removeThinkingBubble(thinkingId);
    addMessageBubble('assistant', `⚠️ Screen Vision Error: ${err.message}`, { isError: true });
  }
};

// ==============================================================================
// AESTHETICS & GLOW THEME SYSTEM (Dynamic CSS Tokens & Particle Synchronization)
// ==============================================================================
// AESTHETICS & GLOW THEME SYSTEM (Dynamic CSS Tokens & Particle Synchronization)
// ==============================================================================
const THEME_PRESETS = {
  blue_orange: {
    '--blue-primary': '#00f3ff',
    '--blue-bright': '#38f8ff',
    '--blue-deep': '#0099ff',
    '--blue-dark': '#0066cc',
    '--blue-glow': 'rgba(0, 243, 255, 0.65)',
    '--blue-glow-subtle': 'rgba(0, 243, 255, 0.20)',
    '--orange-primary': '#ff5e00',
    '--orange-bright': '#ff8400',
    '--orange-deep': '#e64a00',
    '--orange-dark': '#cc3700',
    '--orange-glow': 'rgba(255, 94, 0, 0.65)',
    '--orange-glow-subtle': 'rgba(255, 94, 0, 0.20)',
    '--border-glass': 'rgba(0, 243, 255, 0.35)',
    '--border-orange': 'rgba(255, 94, 0, 0.45)',
    '--grad-blue-orange': 'linear-gradient(135deg, #00f3ff 0%, #ff5e00 100%)',
    '--grad-orange-blue': 'linear-gradient(135deg, #ff5e00 0%, #00f3ff 100%)'
  },
  cyan_amber: {
    '--blue-primary': '#00ffcc',
    '--blue-bright': '#38ffe0',
    '--blue-deep': '#00c49f',
    '--blue-dark': '#008a70',
    '--blue-glow': 'rgba(0, 255, 204, 0.65)',
    '--blue-glow-subtle': 'rgba(0, 255, 204, 0.20)',
    '--orange-primary': '#ffaa00',
    '--orange-bright': '#ffc233',
    '--orange-deep': '#e69500',
    '--orange-dark': '#b37400',
    '--orange-glow': 'rgba(255, 170, 0, 0.65)',
    '--orange-glow-subtle': 'rgba(255, 170, 0, 0.20)',
    '--border-glass': 'rgba(0, 255, 204, 0.35)',
    '--border-orange': 'rgba(255, 170, 0, 0.45)',
    '--grad-blue-orange': 'linear-gradient(135deg, #00ffcc 0%, #ffaa00 100%)',
    '--grad-orange-blue': 'linear-gradient(135deg, #ffaa00 0%, #00ffcc 100%)'
  },
  emerald_neon: {
    '--blue-primary': '#00ff88',
    '--blue-bright': '#52ffa7',
    '--blue-deep': '#00cc66',
    '--blue-dark': '#00994d',
    '--blue-glow': 'rgba(0, 255, 136, 0.65)',
    '--blue-glow-subtle': 'rgba(0, 255, 136, 0.20)',
    '--orange-primary': '#00f0ff',
    '--orange-bright': '#4df4ff',
    '--orange-deep': '#00b8c4',
    '--orange-dark': '#00808a',
    '--orange-glow': 'rgba(0, 240, 255, 0.65)',
    '--orange-glow-subtle': 'rgba(0, 240, 255, 0.20)',
    '--border-glass': 'rgba(0, 255, 136, 0.35)',
    '--border-orange': 'rgba(0, 240, 255, 0.45)',
    '--grad-blue-orange': 'linear-gradient(135deg, #00ff88 0%, #00f0ff 100%)',
    '--grad-orange-blue': 'linear-gradient(135deg, #00f0ff 0%, #00ff88 100%)'
  },
  crimson_violet: {
    '--blue-primary': '#b026ff',
    '--blue-bright': '#c766ff',
    '--blue-deep': '#8c00e6',
    '--blue-dark': '#6900ad',
    '--blue-glow': 'rgba(176, 38, 255, 0.65)',
    '--blue-glow-subtle': 'rgba(176, 38, 255, 0.20)',
    '--orange-primary': '#ff0055',
    '--orange-bright': '#ff4785',
    '--orange-deep': '#cc0044',
    '--orange-dark': '#990033',
    '--orange-glow': 'rgba(255, 0, 85, 0.65)',
    '--orange-glow-subtle': 'rgba(255, 0, 85, 0.20)',
    '--border-glass': 'rgba(176, 38, 255, 0.35)',
    '--border-orange': 'rgba(255, 0, 85, 0.45)',
    '--grad-blue-orange': 'linear-gradient(135deg, #b026ff 0%, #ff0055 100%)',
    '--grad-orange-blue': 'linear-gradient(135deg, #ff0055 0%, #b026ff 100%)'
  },
  midnight_blue: {
    '--blue-primary': '#2979ff',
    '--blue-bright': '#6ea4ff',
    '--blue-deep': '#1565c0',
    '--blue-dark': '#0d47a1',
    '--blue-glow': 'rgba(41, 121, 255, 0.65)',
    '--blue-glow-subtle': 'rgba(41, 121, 255, 0.20)',
    '--orange-primary': '#ff6d00',
    '--orange-bright': '#ff9638',
    '--orange-deep': '#d95a00',
    '--orange-dark': '#a64500',
    '--orange-glow': 'rgba(255, 109, 0, 0.65)',
    '--orange-glow-subtle': 'rgba(255, 109, 0, 0.20)',
    '--border-glass': 'rgba(41, 121, 255, 0.35)',
    '--border-orange': 'rgba(255, 109, 0, 0.45)',
    '--grad-blue-orange': 'linear-gradient(135deg, #2979ff 0%, #ff6d00 100%)',
    '--grad-orange-blue': 'linear-gradient(135deg, #ff6d00 0%, #2979ff 100%)'
  }
};

window.applyTheme = function(themeKey) {
  state.currentTheme = themeKey || 'blue_orange';
  const theme = THEME_PRESETS[themeKey] || THEME_PRESETS['blue_orange'];
  const root = document.documentElement;
  for (const [prop, val] of Object.entries(theme)) {
    root.style.setProperty(prop, val);
  }

  // Persist locally
  try {
    localStorage.setItem('vedas_theme', themeKey);
  } catch (e) {}

  // Update dropdown value if present
  const select = document.getElementById('setting-theme-palette');
  if (select && select.value !== themeKey) {
    select.value = themeKey;
  }

  // Update particles canvas colors
  if (window.vedasParticles && typeof window.vedasParticles.setColor === 'function') {
    window.vedasParticles.setColor(theme['--blue-primary'], theme['--orange-primary']);
  }
};

window.cycleTheme = function() {
  const keys = Object.keys(THEME_PRESETS);
  const current = state.currentTheme || 'blue_orange';
  const nextIdx = (keys.indexOf(current) + 1) % keys.length;
  const nextTheme = keys[nextIdx];
  applyTheme(nextTheme);
  const names = {
    blue_orange: 'Cyber Electric Blue & Orange',
    cyan_amber: 'Cyber Mint & Solar Gold',
    emerald_neon: 'Laser Matrix Emerald & Aqua',
    crimson_violet: 'Ultraviolet Neon & Rose',
    midnight_blue: 'Hyper Cobalt & Blaze'
  };
  showToast(`Palette: ${names[nextTheme] || nextTheme}`, '🎨');
};

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      showToast('Fullscreen Neural HUD Activated', '⛶');
    }).catch(err => {
      console.log('Fullscreen notice:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        showToast('Standard Window Restored', '🗗');
      }).catch(() => {});
    }
  }
};

// Automatic Terminal & Server Lifecycle: cleanly terminate terminal when window is closed
window.addEventListener('beforeunload', () => {
  try {
    navigator.sendBeacon('/api/system/window-closed');
  } catch (e) {}
});

window.addEventListener('pagehide', () => {
  try {
    navigator.sendBeacon('/api/system/window-closed');
  } catch (e) {}
});
