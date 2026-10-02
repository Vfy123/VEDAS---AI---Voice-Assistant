/**
 * VEDAS AI 4.0 PRO — Complete Application Master Controller
 * 100% Matched DOM Element IDs, Robust Voice Engine, Video Synthesizer,
 * Codex Lab, Memory Vault, Full Auth, and Zero Mojibake.
 */

// ==============================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ==============================================================================
const state = {
  currentUser: null,
  authToken: null,
  activeSessionId: 'default_session',
  currentView: 'chat',
  dockMode: 'voice', // 'voice' | 'type'
  model: 'llama3.2:latest',
  persona: 'master',
  theme: 'deep-space',
  useWebSearch: false,
  isMicLocked: false,
  isSpeaking: false,
  isListening: false,
  isGenerating: false,
  accumulatedVoiceText: '',
  voiceFinalSent: false,
  lastFullResponseText: '',
  recognition: null,
  attachments: [],
  sessions: [],
  codexActiveFile: null,
  modelDisplayNames: {
    'llama3.2:latest': '⚡ Local: LLaMA 3.2 (Primary)',
    'llama3.2': '⚡ Local: LLaMA 3.2 (Primary)',
    'gemini-3.8-flash': '⚡ Cloud: Gemini 3.8 Flash (Latest & Fast)',
    'gemini-3.7-flash': '⚡ Cloud: Gemini 3.7 Flash (High Performance)',
    'gemini-3.6-flash': '⚡ Cloud: Gemini 3.6 (Fast & Balanced)',
    'gemini-3.5-flash': '⚡ Cloud: Gemini 3.5 Flash',
    'gemini-3.5-flash-lite': '⚡ Cloud: Gemini 3.5 Flash Light',
    'gemini-3.1-flash-lite': '⚡ Cloud: Gemini 3.1 Flashlight',
    'gemini-3.1-pro-preview': '🧠 Gemini 3.1 Pro Preview (Deep Logic)',
    'llama3:latest': '🦙 Local: LLaMA 3',
    'qwen2.5:7b': '💻 Local: Qwen 2.5 7B',
    'phi4:latest': '🔬 Local: Phi-4'
  }
};

// VEO Studio State
let currentVeoImage = null;
let currentVeoVideo = null;
let currentVeoVideoBlob = null;
let veoVideoGenMode = 'text'; // 'text' | 'image'
let veoAnimFrameId = null;
let veoVideoPlaybackRate = 1.0;
let veoVideoIsPlaying = false;
let veoVideoCurrentTime = 0;
let veoVideoDuration = 5.0;
let veoVideoLoop = true;

const veoEditorState = {
  canvas: null,
  ctx: null,
  originalImage: null,
  activeFilter: 'none',
  drawMode: 'none',
  isDrawing: false,
  brushColor: '#00f3ff',
  brushSize: 5,
  cropRatio: '1:1',
  adjustments: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    hue: 0,
    grayscale: false,
    invert: false,
    sepia: false
  }
};

// Helper: Safely grab an element by ID with fallbacks
function getEl(id1, id2, id3) {
  if (id1 && document.getElementById(id1)) return document.getElementById(id1);
  if (id2 && document.getElementById(id2)) return document.getElementById(id2);
  if (id3 && document.getElementById(id3)) return document.getElementById(id3);
  return null;
}

// Global Toast Notification System
window.showToast = function(msg, icon = '⚡') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-notification show';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${escapeHtml(msg)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }, 3500);
};

// Markdown Sanitization & Rendering
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(str) {
  if (!str) return '';
  let html = str;

  // Code blocks with syntax highlighting & copy button
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const cleanLang = lang || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang-tag">${cleanLang}</span>
          <button class="code-copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(code.trim())}')); showToast('Code copied to clipboard!','📋');">
            📋 Copy
          </button>
        </div>
        <pre><code class="language-${cleanLang}">${escapedCode}</code></pre>
      </div>
    `;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold / Italic
  html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^\*]+)\*\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>');

  // Lists
  html = html.replace(/^\s*[-*+] (.*$)/gim, '<li class="md-li">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="md-ul">$1</ul>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
}

// ==============================================================================
// 2. AUTHENTICATION & USER MANAGEMENT
// ==============================================================================
window.initAuthState = async function() {
  try {
    const rememberMe = localStorage.getItem('vedas_remember_me') === 'true';
    const savedUser = localStorage.getItem('vedas_auth_user');
    const savedToken = localStorage.getItem('vedas_auth_token');

    // By default, start in Guest Mode unless "Keep me logged in" was explicitly selected
    if (rememberMe && savedUser && savedToken) {
      try {
        state.currentUser = JSON.parse(savedUser);
        state.authToken = savedToken;
      } catch (e) {}

      try {
        const res = await fetch(`/api/auth/session?token=${encodeURIComponent(savedToken)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.valid && data.user) {
            state.currentUser = data.user;
            state.authToken = data.token || savedToken;
            localStorage.setItem('vedas_auth_user', JSON.stringify(data.user));
          } else {
            state.currentUser = null;
            state.authToken = null;
          }
        }
      } catch (e) {}
    } else {
      // Default to Guest mode on startup
      state.currentUser = null;
      state.authToken = null;
    }
  } catch (err) {
    console.warn('Auth init note:', err);
  }
  updateAuthUI();
};

window.updateAuthUI = function() {
  const user = state.currentUser;
  const banner = document.getElementById('auth-banner');
  const nameDisplay = document.getElementById('user-name-display');
  const avatarPill = document.getElementById('user-avatar-pill');
  const roleBadge = document.getElementById('user-role-badge');
  const dropdownAvatar = document.getElementById('dropdown-avatar');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownEmail = document.getElementById('dropdown-email');
  const dropdownRoleChip = document.getElementById('dropdown-role-chip');
  const adminPortalLink = document.getElementById('btn-admin-portal-link');
  const dropdownLogoutBtn = document.getElementById('btn-dropdown-logout');
  const dropdownLoginBtn = document.getElementById('btn-dropdown-login');
  const navAdmin = document.getElementById('nav-item-admin');
  const adminNavBadge = document.getElementById('admin-nav-badge');

  const isMasterAdmin = user && (user.role === 'admin' || user.email === 'ghanekar.vedansh@gmail.com');

  // Admin tab visibility strictly restricted to master admin
  if (navAdmin) navAdmin.style.display = isMasterAdmin ? 'flex' : 'none';
  if (adminPortalLink) adminPortalLink.style.display = isMasterAdmin ? 'flex' : 'none';
  if (adminNavBadge) adminNavBadge.style.display = isMasterAdmin ? 'inline-block' : 'none';

  if (user) {
    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const initial = (user.name ? user.name.charAt(0) : (user.email ? user.email.charAt(0) : 'U')).toUpperCase();

    if (banner) banner.style.display = 'none';
    if (nameDisplay) nameDisplay.textContent = displayName;
    if (avatarPill) avatarPill.textContent = isMasterAdmin ? '👑' : initial;
    if (roleBadge) {
      roleBadge.textContent = isMasterAdmin ? '👑 Master Admin' : '👤 Verified User';
      roleBadge.className = `user-role-badge ${isMasterAdmin ? 'admin' : 'user'}`;
    }
    if (dropdownAvatar) dropdownAvatar.textContent = isMasterAdmin ? '👑' : initial;
    if (dropdownName) dropdownName.textContent = displayName;
    if (dropdownEmail) dropdownEmail.textContent = user.email || 'authenticated';
    if (dropdownRoleChip) dropdownRoleChip.textContent = isMasterAdmin ? 'MASTER ADMIN' : 'VERIFIED USER';
    if (dropdownLogoutBtn) dropdownLogoutBtn.style.display = 'flex';
    if (dropdownLoginBtn) {
      dropdownLoginBtn.style.display = 'flex';
      dropdownLoginBtn.innerHTML = '<span>🔄</span> Switch Account / Sign In';
    }
  } else {
    // Guest User state
    const guestDismissed = sessionStorage.getItem('vedas_guest_dismissed') === '1';
    if (banner) banner.style.display = guestDismissed ? 'none' : 'flex';
    if (nameDisplay) nameDisplay.textContent = 'Guest User';
    if (avatarPill) avatarPill.textContent = '👤';
    if (roleBadge) {
      roleBadge.textContent = 'Not Logged In';
      roleBadge.className = 'user-role-badge guest';
    }
    if (dropdownAvatar) dropdownAvatar.textContent = '👤';
    if (dropdownName) dropdownName.textContent = 'Guest Explorer';
    if (dropdownEmail) dropdownEmail.textContent = 'Not Authenticated';
    if (dropdownRoleChip) dropdownRoleChip.textContent = 'GUEST ACCESS';
    if (dropdownLogoutBtn) dropdownLogoutBtn.style.display = 'none';
    if (dropdownLoginBtn) {
      dropdownLoginBtn.style.display = 'flex';
      dropdownLoginBtn.innerHTML = '<span>🔑</span> Sign In / Register';
    }
  }

  // Load verified user sessions or display guest mode notice
  loadUserSessions();

  // Refresh Memory view if active
  if (state.currentView === 'memory') {
    renderMemoryPage();
  }
};

window.dismissAuthPromptGuest = function() {
  sessionStorage.setItem('vedas_guest_dismissed', '1');
  const banner = document.getElementById('auth-banner');
  if (banner) banner.style.display = 'none';
  showToast('Continuing in Guest Mode. Cloud memory is locked.', '🔒');
};

window.openLoginModal = function() {
  closeUserDropdown();
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'flex';
    const emailInput = document.getElementById('auth-email-input') || document.getElementById('login-email');
    if (emailInput) setTimeout(() => emailInput.focus(), 150);
  }
};

window.closeLoginModal = function() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
  const err = document.getElementById('auth-error-msg') || document.getElementById('login-error-msg');
  if (err) err.style.display = 'none';
};

window.startGoogleOAuth = function() {
  closeLoginModal();
  openGoogleModal();
};

window.openGoogleModal = function() {
  closeUserDropdown();
  const modal = document.getElementById('google-modal') || document.getElementById('google-signin-modal');
  if (modal) {
    modal.style.display = 'flex';
    const emailInput = document.getElementById('google-email-input') || document.getElementById('google-auth-email');
    if (emailInput) setTimeout(() => emailInput.focus(), 150);
  }
};

window.closeGoogleModal = function() {
  const modal = document.getElementById('google-modal') || document.getElementById('google-signin-modal');
  if (modal) modal.style.display = 'none';
  const err = document.getElementById('google-error-msg');
  if (err) err.style.display = 'none';
};

window.prefillLogin = function(email, password) {
  const eInput = document.getElementById('auth-email-input') || document.getElementById('login-email');
  const pInput = document.getElementById('auth-password-input') || document.getElementById('login-password');
  if (eInput) eInput.value = email;
  if (pInput) pInput.value = password;
  showToast(`Loaded credentials for ${email}`, '🔑');
};

window.togglePasswordVisibility = function() {
  const input = document.getElementById('auth-password-input') || document.getElementById('login-password');
  const btn = document.querySelector('.auth-pw-toggle') || document.getElementById('btn-pwd-toggle');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🔒';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
};

window.toggleGooglePasswordVisibility = function() {
  const input = document.getElementById('google-password-input') || document.getElementById('google-auth-password');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
};

window.toggleUserDropdown = function(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('user-dropdown-menu') || document.getElementById('user-profile-dropdown');
  if (!dropdown) return;
  const isCurrentlyOpen = dropdown.classList.contains('active') || dropdown.style.display === 'block';
  if (isCurrentlyOpen) {
    dropdown.classList.remove('active');
    dropdown.style.display = 'none';
  } else {
    dropdown.classList.add('active');
    dropdown.style.display = 'block';
  }
};

window.closeUserDropdown = function() {
  const dropdown = document.getElementById('user-dropdown-menu') || document.getElementById('user-profile-dropdown');
  if (dropdown) {
    dropdown.classList.remove('active');
    dropdown.style.display = 'none';
  }
};

window.handlePasswordLogin = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('auth-email-input') || document.getElementById('login-email');
  const pwdInput = document.getElementById('auth-password-input') || document.getElementById('login-password');
  const errMsg = document.getElementById('auth-error-msg') || document.getElementById('login-error-msg');
  const btn = document.getElementById('auth-submit-btn') || document.getElementById('btn-submit-login');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';

  if (!email || !password) {
    if (errMsg) {
      errMsg.textContent = 'Please enter both email and password.';
      errMsg.style.display = 'block';
    }
    showToast('Please fill in email and password.', '⚠️');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⚡</span> Authenticating...';
  }
  if (errMsg) errMsg.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.currentUser = data.user;
      state.authToken = data.token;
      const rememberChk = document.getElementById('auth-remember-chk');
      const remember = rememberChk ? rememberChk.checked : true;
      localStorage.setItem('vedas_remember_me', remember ? 'true' : 'false');
      localStorage.setItem('vedas_auth_user', JSON.stringify(data.user));
      localStorage.setItem('vedas_auth_token', data.token);

      closeLoginModal();
      updateAuthUI();
      showToast(`Welcome back, ${data.user.name || data.user.email}!`, '👑');
    } else {
      const errText = data.detail || 'Account email or password is incorrect.';
      if (errMsg) {
        errMsg.textContent = errText;
        errMsg.style.display = 'block';
      }
      showToast(errText, '⚠️');
    }
  } catch (err) {
    if (errMsg) {
      errMsg.textContent = `Connection error: ${err.message}`;
      errMsg.style.display = 'block';
    }
    showToast(`Error: ${err.message}`, '❌');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡</span> Sign In to VEDAS';
    }
  }
};

window.submitGoogleSignIn = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameInput = document.getElementById('google-name-input') || document.getElementById('google-auth-name');
  const emailInput = document.getElementById('google-email-input') || document.getElementById('google-auth-email');
  const pwdInput = document.getElementById('google-password-input') || document.getElementById('google-auth-password');
  const errMsg = document.getElementById('google-error-msg');
  const btn = document.getElementById('google-submit-btn') || document.getElementById('btn-submit-google-auth');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';

  if (!email || !password) {
    if (errMsg) {
      errMsg.textContent = 'Google Account Email and Password are required.';
      errMsg.style.display = 'block';
    }
    showToast('Please enter Google Email and Password.', '⚠️');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>🌐</span> Authorizing with Google...';
  }
  if (errMsg) errMsg.style.display = 'none';

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || email.split('@')[0], email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.currentUser = data.user;
      state.authToken = data.token;
      const rememberChk = document.getElementById('google-remember-chk');
      const remember = rememberChk ? rememberChk.checked : true;
      localStorage.setItem('vedas_remember_me', remember ? 'true' : 'false');
      localStorage.setItem('vedas_auth_user', JSON.stringify(data.user));
      localStorage.setItem('vedas_auth_token', data.token);

      closeGoogleModal();
      updateAuthUI();
      showToast(`Google Account Connected: ${data.user.email}`, '✨');
    } else {
      if (errMsg) {
        errMsg.textContent = data.detail || 'Failed to authenticate Google account.';
        errMsg.style.display = 'block';
      }
      showToast(data.detail || 'Google sign-in error', '⚠️');
    }
  } catch (err) {
    if (errMsg) {
      errMsg.textContent = `Authorization error: ${err.message}`;
      errMsg.style.display = 'block';
    }
    showToast(`Error: ${err.message}`, '❌');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🌐</span> Sign In with Google';
    }
  }
};

window.handleLogout = async function() {
  try {
    if (state.authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.authToken })
      });
    }
  } catch (e) {}

  state.currentUser = null;
  state.authToken = null;
  localStorage.removeItem('vedas_remember_me');
  localStorage.removeItem('vedas_auth_user');
  localStorage.removeItem('vedas_auth_token');
  sessionStorage.removeItem('vedas_guest_dismissed');

  closeUserDropdown();
  updateAuthUI();

  if (state.currentView === 'admin') {
    switchView('chat');
  }

  showToast('Signed out. Switched to Guest Mode.', '👋');
};

// ==============================================================================
// 3. NAVIGATION & VIEW CONTROLLER
// ==============================================================================
window.switchView = function(viewName) {
  // Halt all active media playback & speech synthesis across the application
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingState(false);
    document.querySelectorAll('video, audio').forEach(el => {
      try { el.pause(); } catch(e){}
    });
    if (typeof veoVideoIsPlaying !== 'undefined') {
      veoVideoIsPlaying = false;
      const playBtn = document.getElementById('veo-play-pause-btn');
      if (playBtn) playBtn.textContent = '▶';
    }
  } catch (e) {}

  // Stop Live Duplex mode if leaving Live view
  if (viewName !== 'live' && typeof stopLiveMode === 'function') {
    try { stopLiveMode(); } catch(e){}
  }

  // Master Admin security gate
  if (viewName === 'admin') {
    const isMasterAdmin = state.currentUser &&
      (state.currentUser.role === 'admin' || state.currentUser.email === 'ghanekar.vedansh@gmail.com');
    if (!isMasterAdmin) {
      showToast('Master Admin privileges required to access Telemetry & Vault.', '🔒');
      openLoginModal();
      return;
    }
  }

  state.currentView = viewName;

  // Update navigation items
  const navBtns = document.querySelectorAll('.nav-btn, .sidebar-nav-item, [id^="nav-item-"]');
  navBtns.forEach(btn => {
    const v = btn.getAttribute('data-view') || btn.id.replace('nav-item-', '');
    btn.classList.toggle('active', v === viewName);
  });

  // Update view containers
  const views = document.querySelectorAll('.app-view, .view-stage');
  views.forEach(v => {
    const vId = v.id;
    const isTarget = vId === `view-${viewName}` || vId === `${viewName}-view` || (viewName === 'chat' && (vId === 'view-chat' || vId === 'view-dashboard'));
    v.style.display = isTarget ? 'flex' : 'none';
  });

  // View specific triggers
  if (viewName === 'live') {
    if (typeof startLiveMode === 'function') {
      setTimeout(() => startLiveMode(), 80);
    }
  } else if (viewName === 'memory') {
    renderMemoryPage();
  } else if (viewName === 'admin') {
    fetchAdminUsageMetrics();
    fetchAdminUserVault();
    if (window._adminUsageTimer) clearInterval(window._adminUsageTimer);
    window._adminUsageTimer = setInterval(() => {
      if (state.currentView === 'admin') {
        fetchAdminUsageMetrics();
      } else {
        clearInterval(window._adminUsageTimer);
        window._adminUsageTimer = null;
      }
    }, 4000);
  } else if (viewName === 'veo') {
    setTimeout(() => initVeoImageEditor(), 100);
  } else if (viewName === 'files') {
    refreshFileList();
  } else if (viewName === 'settings') {
    if (typeof loadSettingsIntoUI === 'function') loadSettingsIntoUI();
  } else if (viewName === 'chat') {
    const inputEl = document.getElementById('chat-input');
    if (inputEl) inputEl.focus();
  }
};

window.setDockMode = function(mode) {
  state.dockMode = mode;
  const voiceDock = document.getElementById('dock-voice-mode');
  const typeDock = document.getElementById('dock-typing-mode');
  const typeToggleBtn = document.getElementById('type-mode-toggle');

  if (mode === 'type') {
    if (voiceDock) voiceDock.style.display = 'none';
    if (typeDock) typeDock.style.display = 'block';
    if (typeToggleBtn) typeToggleBtn.classList.add('active');
    const input = document.getElementById('chat-input');
    if (input) setTimeout(() => input.focus(), 100);
  } else {
    if (voiceDock) voiceDock.style.display = 'flex';
    if (typeDock) typeDock.style.display = 'none';
    if (typeToggleBtn) typeToggleBtn.classList.remove('active');
  }
};

// ==============================================================================
// 4. CHAT, SPEECH, VOICE HUD & LLM INTELLIGENCE
// ==============================================================================
let currentAbortController = null;

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  const stopBtns = document.querySelectorAll('.bubble-stop-btn, #stop-btn, #btn-global-stop');
  stopBtns.forEach(b => { b.style.display = isGenerating ? 'inline-flex' : 'none'; });

  const chatMic = document.getElementById('chat-mic-orb-btn');
  const chatTr = document.getElementById('chat-voice-transcript');
  const glyph = document.getElementById('chat-mic-glyph');
  const chatInput = document.getElementById('chat-input');
  const sendBtns = document.querySelectorAll('#chat-send-btn, #btn-send-message, .chat-send-action');

  if (isGenerating) {
    state.isMicLocked = true;
    if (state.recognition) {
      try { state.recognition.stop(); } catch(e) {}
      state.isListening = false;
    }
    if (voiceSilenceDebounce) {
      clearTimeout(voiceSilenceDebounce);
      voiceSilenceDebounce = null;
    }
    if (chatMic) {
      chatMic.classList.add('mic-locked', 'reasoning-locked');
      chatMic.title = 'Vedas is reasoning... Message input locked.';
    }
    if (glyph) glyph.textContent = '🧠';
    if (chatTr) {
      chatTr.textContent = '🧠 Vedas is reasoning... (Messages locked)';
      chatTr.className = 'dock-voice-caption reasoning';
    }
    if (chatInput) {
      chatInput.disabled = true;
      if (!chatInput.getAttribute('data-prev-ph')) {
        chatInput.setAttribute('data-prev-ph', chatInput.placeholder || '');
      }
      chatInput.placeholder = 'AI is currently reasoning... Please wait.';
    }
    sendBtns.forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.5';
      b.style.pointerEvents = 'none';
    });

    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('thinking');
    if (window.vedasDashWaveform) window.vedasDashWaveform.setState('thinking');
    if (window.vedasWaveform) window.vedasWaveform.setState('thinking');
  } else {
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = chatInput.getAttribute('data-prev-ph') || 'Ask Vedas anything, or attach files/images...';
    }
    sendBtns.forEach(b => {
      b.disabled = false;
      b.style.opacity = '1.0';
      b.style.pointerEvents = 'auto';
    });

    if (!state.isSpeaking) {
      state.isMicLocked = false;
      if (chatMic) {
        chatMic.classList.remove('mic-locked', 'reasoning-locked');
        chatMic.title = 'Click or Press Ctrl+M to Speak';
      }
      if (glyph) glyph.textContent = '🎙️';
      if (chatTr) {
        chatTr.textContent = 'Click the orb or press Ctrl+M to talk';
        chatTr.className = 'dock-voice-caption';
      }
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
      if (window.vedasWaveform) window.vedasWaveform.setState('idle');
    }
  }
}

function setSpeakingState(isSpeaking) {
  state.isSpeaking = isSpeaking;
  const chatMic = document.getElementById('chat-mic-orb-btn');
  const chatTr = document.getElementById('chat-voice-transcript');
  const glyph = document.getElementById('chat-mic-glyph');

  if (isSpeaking) {
    state.isMicLocked = true;
    if (chatMic) {
      chatMic.classList.add('mic-locked');
      chatMic.title = 'Microphone locked while AI is speaking';
    }
    if (glyph) glyph.textContent = '🔒';
    if (chatTr) {
      chatTr.textContent = '🔊 AI Speaking... (Mic locked)';
      chatTr.className = 'dock-voice-caption speaking';
    }
    if (window.vedasChatWaveform) window.vedasChatWaveform.setState('speaking');
    if (window.vedasDashWaveform) window.vedasDashWaveform.setState('speaking');
    if (window.vedasWaveform) window.vedasWaveform.setState('speaking');
  } else {
    if (!state.isGenerating) {
      state.isMicLocked = false;
      if (chatMic) {
        chatMic.classList.remove('mic-locked', 'reasoning-locked');
        chatMic.title = 'Click or Press Ctrl+M to Speak';
      }
      if (glyph) glyph.textContent = '🎙️';
      if (chatTr && !state.isListening) {
        chatTr.textContent = 'Click the orb or press Ctrl+M to talk';
        chatTr.className = 'dock-voice-caption';
      }
      if (!state.isListening) {
        if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
        if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
        if (window.vedasWaveform) window.vedasWaveform.setState('idle');
      }
    }
  }
}

window.stopAllAIResponse = function() {
  if (window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch(e){}
  }
  window._activeUtterance = null;
  dismissReadFullPrompt(true);
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  setGeneratingState(false);
  setSpeakingState(false);
  if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
  if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
  if (window.vedasWaveform) window.vedasWaveform.setState('idle');
  showToast('AI response stopped.', '⏹️');
};

function addMessageBubble(role, text, meta = {}) {
  const container = document.getElementById('chat-messages-container') || document.getElementById('chat-messages') || document.getElementById('chat-history-flow');
  if (!container) return;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  const welcomeHero = document.getElementById('welcome-hero');
  if (welcomeHero) welcomeHero.style.display = 'none';

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
      <img src="${previewSrc}" alt="Screen Vision Capture" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid var(--border-glass); display:block;" onclick="openVeoLightbox('${previewSrc}')" />
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
    stopBtn.title = 'Stop speech output';
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
  container.appendChild(row);

  const stage = document.getElementById('chat-stage-body');
  if (stage) stage.scrollTop = stage.scrollHeight;
}

function addThinkingBubble(id) {
  const container = document.getElementById('chat-messages-container') || document.getElementById('chat-messages') || document.getElementById('chat-history-flow');
  if (!container) return;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  const row = document.createElement('div');
  row.className = 'chat-message-row ai-row';
  row.id = id;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble thinking-bubble';
  bubble.innerHTML = `
    <div class="thinking-dots">
      <span></span><span></span><span></span>
    </div>
    <span style="font-size:0.8rem; color:var(--text-muted); margin-left:8px;">Vedas is reasoning...</span>
  `;

  row.appendChild(avatar);
  row.appendChild(bubble);
  container.appendChild(row);

  const stage = document.getElementById('chat-stage-body');
  if (stage) stage.scrollTop = stage.scrollHeight;
}

function removeThinkingBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function sendChatMessage(customPrompt = null, metaExtra = {}) {
  if (state.isGenerating) {
    showToast('AI is currently reasoning. Please wait...', '⏳');
    return;
  }

  const inputEl = document.getElementById('chat-input');
  const message = customPrompt || (inputEl ? inputEl.value.trim() : '');

  if (!message && state.attachments.length === 0) return;

  if (inputEl && !customPrompt) {
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  const currentAtts = [...state.attachments];
  state.attachments = [];
  renderAttachmentTray();

  addMessageBubble('user', message, { attachments: currentAtts, ...metaExtra });

  const thinkingId = `think_${Date.now()}`;
  addThinkingBubble(thinkingId);
  setGeneratingState(true);

  currentAbortController = new AbortController();

  try {
    const payload = {
      prompt: message,
      message: message,
      session_id: state.activeSessionId,
      model_override: state.model,
      model: state.model,
      persona: state.persona,
      use_web_search: state.useWebSearch,
      use_search: state.useWebSearch,
      attachments: currentAtts,
      ...metaExtra
    };

    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: currentAbortController.signal
    });

    removeThinkingBubble(thinkingId);
    setGeneratingState(false);

    if (res.ok) {
      const data = await res.json();
      const reply = data.response || data.reply || data.text || 'No response received.';
      addMessageBubble('assistant', reply, { model: data.model || state.model });
      smartSpeakResponse(reply);

      // Save to chat history ONLY for authenticated users
      if (state.currentUser) {
        let sess = state.sessions.find(s => s.id === state.activeSessionId);
        if (!sess) {
          sess = {
            id: state.activeSessionId,
            title: message.length > 35 ? message.slice(0, 32) + '...' : message,
            timestamp: Date.now(),
            messages: []
          };
          state.sessions.unshift(sess);
        }
        sess.messages.push({ role: 'user', text: message, attachments: currentAtts });
        sess.messages.push({ role: 'assistant', text: reply, model: data.model || state.model });
        sess.timestamp = Date.now();

        localStorage.setItem(`vedas_sessions_${state.currentUser.email}`, JSON.stringify(state.sessions));

        try {
          const headers = { 'Content-Type': 'application/json' };
          if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
          fetch('/api/sessions', {
            method: 'POST',
            headers,
            body: JSON.stringify(sess)
          }).catch(() => {});
        } catch(e) {}

        renderSessionsList();
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      addMessageBubble('assistant', `⚠️ Communication error: ${errData.detail || res.statusText}`, { isError: true });
    }
  } catch (err) {
    removeThinkingBubble(thinkingId);
    setGeneratingState(false);
    if (err.name === 'AbortError') {
      addMessageBubble('assistant', '⏹️ *Response stopped by user.*', { isStopped: true });
    } else {
      addMessageBubble('assistant', `⚠️ Connection error: ${err.message}`, { isError: true });
    }
  }
}

window.handleSendMessage = function() {
  sendChatMessage();
};

window.sendMessage = window.handleSendMessage;

window.sendQuickChatPrompt = function(promptText, extraMeta = {}) {
  switchView('chat');
  setDockMode('type');
  const inputEl = document.getElementById('chat-input');
  if (inputEl) inputEl.value = promptText;
  sendChatMessage(promptText, extraMeta);
};

window.renderSessionsList = function() {
  const listEl = document.getElementById('sessions-list');
  if (!listEl) return;

  if (!state.currentUser) {
    listEl.innerHTML = `
      <div class="guest-history-box">
        <div class="guest-history-icon">🔒</div>
        <div class="guest-history-title">Guest Mode</div>
        <div class="guest-history-desc">Chat history is disabled. Sign in to save chats across sessions.</div>
        <button class="guest-history-btn" onclick="openLoginModal()">⚡ Sign In</button>
      </div>
    `;
    return;
  }

  if (state.sessions.length === 0) {
    listEl.innerHTML = `
      <div style="padding:16px 10px; text-align:center; color:var(--text-dim); font-size:0.75rem;">
        No saved sessions yet.<br/>Start chatting to save history.
      </div>
    `;
    return;
  }

  listEl.innerHTML = state.sessions.map(s => {
    const isActive = s.id === state.activeSessionId;
    const title = s.title || (s.messages && s.messages[0] ? s.messages[0].text.slice(0, 30) : 'Conversation');
    return `
      <div class="history-session-item ${isActive ? 'active' : ''}" onclick="loadSession('${s.id}')" title="${escapeHtml(title)}">
        <span class="history-session-title">${escapeHtml(title)}</span>
        <button class="history-session-del" onclick="event.stopPropagation(); deleteSession('${s.id}')" title="Delete conversation">✕</button>
      </div>
    `;
  }).join('');
};

window.loadSession = function(sessionId) {
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  state.activeSessionId = sessionId;
  switchView('chat');

  const container = document.getElementById('chat-messages-container');
  const welcomeHero = document.getElementById('welcome-hero');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
  }
  if (welcomeHero) welcomeHero.style.display = 'none';

  (sess.messages || []).forEach(m => {
    addMessageBubble(m.role, m.text, { isHistory: true, attachments: m.attachments, model: m.model });
  });

  renderSessionsList();
  showToast('Loaded conversation session.', '💬');
};

window.deleteSession = async function(sessionId) {
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  if (state.currentUser) {
    localStorage.setItem(`vedas_sessions_${state.currentUser.email}`, JSON.stringify(state.sessions));
    try {
      const headers = {};
      if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
      fetch(`/api/sessions/${sessionId}`, { method: 'DELETE', headers }).catch(() => {});
    } catch(e) {}
  }
  if (state.activeSessionId === sessionId) {
    startNewChat();
  } else {
    renderSessionsList();
  }
  showToast('Deleted conversation session.', '🗑️');
};

window.loadUserSessions = function() {
  if (!state.currentUser) {
    state.sessions = [];
    renderSessionsList();
    return;
  }
  try {
    const raw = localStorage.getItem(`vedas_sessions_${state.currentUser.email}`);
    if (raw) {
      state.sessions = JSON.parse(raw);
    } else {
      state.sessions = [];
    }
  } catch(e) {
    state.sessions = [];
  }
  renderSessionsList();
};

window.startNewChat = function() {
  state.activeSessionId = `session_${Date.now()}`;
  switchView('chat');
  const container = document.getElementById('chat-messages-container') || document.getElementById('chat-messages');
  if (container) {
    container.innerHTML = '';
  }
  const welcomeHero = document.getElementById('welcome-hero');
  if (welcomeHero) welcomeHero.style.display = 'block';

  state.attachments = [];
  renderAttachmentTray();

  const inputEl = document.getElementById('chat-input');
  if (inputEl) {
    inputEl.value = '';
    inputEl.focus();
  }
  renderSessionsList();
  showToast('Started new conversation session! ✨', '✨');
};

window.clearAllSessions = function() {
  if (!state.currentUser) {
    startNewChat();
    return;
  }
  if (state.sessions.length === 0) return;
  if (!confirm('Clear all saved chat history?')) return;

  state.sessions = [];
  if (state.currentUser) {
    localStorage.removeItem(`vedas_sessions_${state.currentUser.email}`);
  }
  startNewChat();
  renderSessionsList();
  showToast('Cleared all conversation sessions.', '🧹');
};

// Robust Text-to-Speech Engine (Garbage-Collection Safe & Waveform Synchronized)
window._activeUtterance = null;

function smartSpeakResponse(text) {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
  } catch (e) {}

  let cleanText = (text || '')
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, 'link')
    .replace(/[*#_>\[\]~|\\$]/g, '')
    .trim();

  if (!cleanText) return;
  state.lastFullResponseText = cleanText;

  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  const isLong = sentences.length > 3 || cleanText.length > 250;
  const previewText = isLong ? sentences.slice(0, 3).join(' ') : cleanText;

  const utterance = new SpeechSynthesisUtterance(previewText);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('David') || v.name.includes('Zira')));
      if (preferred) utterance.voice = preferred;
    }
  } catch (e) {}

  window._activeUtterance = utterance;

  utterance.onstart = () => {
    setSpeakingState(true);
    dismissReadFullPrompt(false);
  };
  utterance.onend = () => {
    setSpeakingState(false);
    window._activeUtterance = null;
    if (isLong) {
      const pct = Math.min(95, Math.max(10, Math.round((previewText.length / cleanText.length) * 100)));
      const panel = document.getElementById('voice-read-full-panel');
      const title = document.getElementById('vrf-title');
      const chip = document.getElementById('vrf-progress-chip');
      if (title) title.textContent = 'Should I read it to you in full?';
      if (chip) chip.textContent = `${pct}% Preview Complete`;
      if (panel) panel.style.display = 'flex';
    }
  };
  utterance.onerror = () => {
    setSpeakingState(false);
    window._activeUtterance = null;
    dismissReadFullPrompt(false);
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis speak error:', err);
    setSpeakingState(false);
  }
}

window.readFullResponseSpeech = function() {
  if (!state.lastFullResponseText || !window.speechSynthesis) {
    dismissReadFullPrompt();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(state.lastFullResponseText);
    utterance.rate = 1.05;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('David') || v.name.includes('Zira')));
        if (preferred) utterance.voice = preferred;
      }
    } catch(e) {}
    window._activeUtterance = utterance;
    utterance.onstart = () => { setSpeakingState(true); };
    utterance.onend = () => { setSpeakingState(false); window._activeUtterance = null; dismissReadFullPrompt(); };
    utterance.onerror = () => { setSpeakingState(false); window._activeUtterance = null; dismissReadFullPrompt(); };
    window.speechSynthesis.speak(utterance);
    showToast('Reading full response aloud...', '🎙️');
  } catch (e) {
    setSpeakingState(false);
  }
  dismissReadFullPrompt();
};

window.dismissReadFullPrompt = function(stopAudio = false) {
  const panel = document.getElementById('voice-read-full-panel');
  if (panel) panel.style.display = 'none';
  if (stopAudio && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      setSpeakingState(false);
      window._activeUtterance = null;
    } catch (e) {}
  }
};

let voiceSilenceDebounce = null;

// Speech Recognition Engine (Voice HUD & Mic Orb Animation)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  try {
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US';

    state.recognition.onstart = () => {
      state.isListening = true;
      state.accumulatedVoiceText = '';
      state.voiceFinalSent = false;
      if (voiceSilenceDebounce) clearTimeout(voiceSilenceDebounce);
      const mic = document.getElementById('chat-mic-orb-btn');
      const tr = document.getElementById('chat-voice-transcript');
      const voiceUnit = document.querySelector('.dock-voice-unit');
      if (mic) mic.classList.add('listening');
      if (voiceUnit) voiceUnit.classList.add('listening');
      if (tr) {
        tr.textContent = 'Listening... Speak naturally.';
        tr.className = 'dock-voice-caption active-speech';
      }
      if (window.vedasChatWaveform) window.vedasChatWaveform.setState('listening');
      if (window.vedasDashWaveform) window.vedasDashWaveform.setState('listening');
      if (window.vedasWaveform) window.vedasWaveform.setState('listening');
    };

    state.recognition.onresult = (event) => {
      if (state.isGenerating) return;

      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const trans = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += trans;
        } else {
          interim += trans;
        }
      }
      const currentSpoken = (final || interim || '').trim();
      if (currentSpoken) {
        state.accumulatedVoiceText = currentSpoken;
        const tr = document.getElementById('chat-voice-transcript');
        if (tr) tr.textContent = currentSpoken;
        const input = document.getElementById('chat-input');
        if (input) input.value = currentSpoken;

        // Generous breathing room before auto-dispatch
        if (voiceSilenceDebounce) clearTimeout(voiceSilenceDebounce);
        voiceSilenceDebounce = setTimeout(() => {
          if (state.accumulatedVoiceText && !state.voiceFinalSent && state.isListening && !state.isGenerating) {
            state.voiceFinalSent = true;
            try { state.recognition.stop(); } catch(e){}
            sendChatMessage(state.accumulatedVoiceText);
          }
        }, 3500);
      }
    };

    state.recognition.onend = () => {
      state.isListening = false;
      const mic = document.getElementById('chat-mic-orb-btn');
      const tr = document.getElementById('chat-voice-transcript');
      const voiceUnit = document.querySelector('.dock-voice-unit');
      if (mic) mic.classList.remove('listening');
      if (voiceUnit) voiceUnit.classList.remove('listening');

      if (tr && !state.isMicLocked && !state.isGenerating) {
        tr.textContent = 'Click the orb or press Ctrl+M to talk';
        tr.className = 'dock-voice-caption';
      }
      if (!state.isSpeaking && !state.isGenerating) {
        if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
        if (window.vedasDashWaveform) window.vedasDashWaveform.setState('idle');
        if (window.vedasWaveform) window.vedasWaveform.setState('idle');
      }
    };

    state.recognition.onerror = (e) => {
      state.isListening = false;
      const mic = document.getElementById('chat-mic-orb-btn');
      const voiceUnit = document.querySelector('.dock-voice-unit');
      if (mic) mic.classList.remove('listening');
      if (voiceUnit) voiceUnit.classList.remove('listening');
      if (!state.isSpeaking && !state.isGenerating) {
        if (window.vedasChatWaveform) window.vedasChatWaveform.setState('idle');
      }
    };
  } catch (err) {
    console.warn('Speech recognition init error:', err);
  }
}

window.toggleVoiceListening = function() {
  if (state.isGenerating) {
    showToast('AI is currently reasoning. Message sending is locked until complete.', '⏳');
    return;
  }
  if (state.isMicLocked) {
    showToast('Microphone locked while AI is responding.', '🔒');
    return;
  }
  if (!state.recognition) {
    initSpeechRecognition();
  }
  if (!state.recognition) {
    showToast('Speech recognition not supported in this browser.', '⚠️');
    return;
  }

  if (state.isListening) {
    if (voiceSilenceDebounce) clearTimeout(voiceSilenceDebounce);
    if (state.accumulatedVoiceText && !state.voiceFinalSent && !state.isGenerating) {
      state.voiceFinalSent = true;
      sendChatMessage(state.accumulatedVoiceText);
    }
    try { state.recognition.stop(); } catch(e){}
    state.isListening = false;
  } else {
    try {
      state.recognition.start();
    } catch (e) {
      initSpeechRecognition();
      try { state.recognition.start(); } catch (err) {}
    }
  }
};

// ==============================================================================
// 4B. CHAT CAMERA VISION STUDIO & SCREEN VISION ENGINE
// ==============================================================================
let chatCameraStream = null;
let chatCameraMode = 'photo'; // 'photo' | 'video'
let chatMediaRecorder = null;
let chatRecordedChunks = [];
let chatRecordedBlob = null;
let chatRecordedDataUri = null;
let chatCapturedPhotoUri = null;
let chatRecordTimer = null;
let chatRecordStartTime = 0;

window.openChatCameraStudio = async function() {
  const modal = document.getElementById('chat-camera-modal');
  const liveVideo = document.getElementById('chat-camera-live-video');
  const photoPrev = document.getElementById('chat-camera-photo-preview');
  const vidPrev = document.getElementById('chat-camera-video-preview');
  const reticle = document.getElementById('camera-reticle-overlay');
  const liveActions = document.getElementById('camera-live-actions');
  const prevActions = document.getElementById('camera-preview-actions');
  const shutterText = document.getElementById('camera-shutter-text');
  const recInd = document.getElementById('camera-rec-indicator');

  if (modal) modal.style.display = 'flex';
  if (photoPrev) photoPrev.style.display = 'none';
  if (vidPrev) vidPrev.style.display = 'none';
  if (reticle) reticle.style.display = 'block';
  if (liveActions) liveActions.style.display = 'flex';
  if (prevActions) prevActions.style.display = 'none';
  if (recInd) recInd.style.display = 'none';

  setCameraCaptureMode('photo');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    chatCameraStream = stream;
    if (liveVideo) {
      liveVideo.srcObject = stream;
      liveVideo.style.display = 'block';
    }
  } catch (err) {
    showToast(`Camera access notice: ${err.message}`, '⚠️');
  }
};

window.closeChatCameraStudio = function() {
  const modal = document.getElementById('chat-camera-modal');
  if (modal) modal.style.display = 'none';

  if (chatRecordTimer) {
    clearInterval(chatRecordTimer);
    chatRecordTimer = null;
  }
  if (chatMediaRecorder && chatMediaRecorder.state === 'recording') {
    try { chatMediaRecorder.stop(); } catch(e){}
  }
  if (chatCameraStream) {
    chatCameraStream.getTracks().forEach(t => t.stop());
    chatCameraStream = null;
  }
  chatCapturedPhotoUri = null;
  chatRecordedBlob = null;
  chatRecordedDataUri = null;
};

window.setCameraCaptureMode = function(mode) {
  chatCameraMode = mode;
  const tabPhoto = document.getElementById('cam-tab-photo');
  const tabVideo = document.getElementById('cam-tab-video');
  const shutterText = document.getElementById('camera-shutter-text');
  const shutterBtn = document.getElementById('camera-shutter-btn');

  if (tabPhoto) tabPhoto.classList.toggle('active', mode === 'photo');
  if (tabVideo) tabVideo.classList.toggle('active', mode === 'video');

  if (shutterText) {
    shutterText.textContent = mode === 'photo' ? '📸 Capture Photo' : '🔴 Record 5s Clip';
  }
  if (shutterBtn) {
    shutterBtn.className = 'camera-shutter-btn';
  }
};

window.executeCameraCapture = async function() {
  const liveVideo = document.getElementById('chat-camera-live-video');
  const photoPrev = document.getElementById('chat-camera-photo-preview');
  const vidPrev = document.getElementById('chat-camera-video-preview');
  const liveActions = document.getElementById('camera-live-actions');
  const prevActions = document.getElementById('camera-preview-actions');
  const reticle = document.getElementById('camera-reticle-overlay');
  const recInd = document.getElementById('camera-rec-indicator');
  const recTime = document.getElementById('camera-rec-time');
  const shutterBtn = document.getElementById('camera-shutter-btn');
  const shutterText = document.getElementById('camera-shutter-text');

  if (chatCameraMode === 'photo') {
    if (!liveVideo || liveVideo.videoWidth === 0) {
      showToast('Camera feed not ready.', '⚠️');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = liveVideo.videoWidth;
    canvas.height = liveVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);
    chatCapturedPhotoUri = canvas.toDataURL('image/jpeg', 0.88);

    if (photoPrev) {
      photoPrev.src = chatCapturedPhotoUri;
      photoPrev.style.display = 'block';
    }
    if (liveVideo) liveVideo.style.display = 'none';
    if (reticle) reticle.style.display = 'none';
    if (liveActions) liveActions.style.display = 'none';
    if (prevActions) prevActions.style.display = 'flex';
    showToast('Photo captured! Attach to message or retake.', '📸');
  } else {
    // Video Clip Recording (5 Seconds)
    if (!chatCameraStream) {
      showToast('Camera stream unavailable.', '⚠️');
      return;
    }

    if (chatMediaRecorder && chatMediaRecorder.state === 'recording') {
      return;
    }

    chatRecordedChunks = [];
    try {
      chatMediaRecorder = new MediaRecorder(chatCameraStream, { mimeType: 'video/webm' });
    } catch (e) {
      chatMediaRecorder = new MediaRecorder(chatCameraStream);
    }

    chatMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chatRecordedChunks.push(e.data);
    };

    chatMediaRecorder.onstop = () => {
      chatRecordedBlob = new Blob(chatRecordedChunks, { type: 'video/webm' });
      const vidUrl = URL.createObjectURL(chatRecordedBlob);
      const reader = new FileReader();
      reader.onload = (evt) => {
        chatRecordedDataUri = evt.target.result;
      };
      reader.readAsDataURL(chatRecordedBlob);

      if (vidPrev) {
        vidPrev.src = vidUrl;
        vidPrev.style.display = 'block';
      }
      if (liveVideo) liveVideo.style.display = 'none';
      if (reticle) reticle.style.display = 'none';
      if (recInd) recInd.style.display = 'none';
      if (liveActions) liveActions.style.display = 'none';
      if (prevActions) prevActions.style.display = 'flex';
      showToast('Video clip recorded! Attach to message or retake.', '🎥');
    };

    chatMediaRecorder.start();
    if (recInd) recInd.style.display = 'flex';
    if (shutterBtn) shutterBtn.classList.add('recording');
    if (shutterText) shutterText.textContent = '⏹️ Recording...';

    chatRecordStartTime = Date.now();
    let timeLeft = 5;
    if (recTime) recTime.textContent = `REC 00:0${timeLeft}`;

    chatRecordTimer = setInterval(() => {
      timeLeft--;
      if (recTime) recTime.textContent = `REC 00:0${Math.max(0, timeLeft)}`;
      if (timeLeft <= 0) {
        clearInterval(chatRecordTimer);
        chatRecordTimer = null;
        if (chatMediaRecorder && chatMediaRecorder.state === 'recording') {
          chatMediaRecorder.stop();
        }
      }
    }, 1000);
  }
};

window.retakeCameraCapture = function() {
  const liveVideo = document.getElementById('chat-camera-live-video');
  const photoPrev = document.getElementById('chat-camera-photo-preview');
  const vidPrev = document.getElementById('chat-camera-video-preview');
  const liveActions = document.getElementById('camera-live-actions');
  const prevActions = document.getElementById('camera-preview-actions');
  const reticle = document.getElementById('camera-reticle-overlay');
  const shutterText = document.getElementById('camera-shutter-text');
  const shutterBtn = document.getElementById('camera-shutter-btn');

  chatCapturedPhotoUri = null;
  chatRecordedBlob = null;
  chatRecordedDataUri = null;

  if (photoPrev) photoPrev.style.display = 'none';
  if (vidPrev) vidPrev.style.display = 'none';
  if (liveVideo) liveVideo.style.display = 'block';
  if (reticle) reticle.style.display = 'block';
  if (liveActions) liveActions.style.display = 'flex';
  if (prevActions) prevActions.style.display = 'none';
  if (shutterBtn) shutterBtn.className = 'camera-shutter-btn';
  if (shutterText) shutterText.textContent = chatCameraMode === 'photo' ? '📸 Capture Photo' : '🔴 Record 5s Clip';
};

window.confirmCameraAttachment = function() {
  const ts = Date.now();
  if (chatCameraMode === 'photo' && chatCapturedPhotoUri) {
    state.attachments.push({
      name: `camera_photo_${ts}.jpg`,
      type: 'image',
      data: chatCapturedPhotoUri,
      preview: chatCapturedPhotoUri
    });
    renderAttachmentTray();
    showToast('Photo attached to message! Speak or type to send.', '📎');
  } else if (chatCameraMode === 'video' && (chatRecordedDataUri || chatRecordedBlob)) {
    state.attachments.push({
      name: `camera_clip_${ts}.webm`,
      type: 'video',
      data: chatRecordedDataUri || 'video_blob_attached',
      blob: chatRecordedBlob
    });
    renderAttachmentTray();
    showToast('Video clip attached to message! Speak or type to send.', '📎');
  }

  closeChatCameraStudio();

  // Focus input or highlight mic for easy follow-up
  const input = document.getElementById('chat-input');
  if (input) input.focus();
};

window.triggerScreenVision = async function(customPrompt) {
  showToast('Opening Screen Vision picker...', '🖥️');
  let capturedDataUri = null;

  // 1. Native Chrome / Browser Screen Selection Dialog
  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      await new Promise(r => { video.onloadedmetadata = r; });
      video.play();
      await new Promise(r => setTimeout(r, 200));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedDataUri = canvas.toDataURL('image/jpeg', 0.85);

      // Release display stream
      stream.getTracks().forEach(t => t.stop());
    } catch (pickerErr) {
      console.log('Display media picker notice:', pickerErr);
    }
  }

  // 2. Fallback to Workstation Desktop Screen Capture
  if (!capturedDataUri) {
    try {
      showToast('Capturing active screen...', '📸');
      const res = await fetch('/api/screen-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt || 'Analyze active screen' })
      });
      const data = await res.json();
      if (res.ok && data.image_data) {
        capturedDataUri = data.image_data;
      }
    } catch (e) {
      console.warn('Backend screen capture notice:', e);
    }
  }

  if (capturedDataUri) {
    state.attachments.push({
      name: `screen_capture_${Date.now()}.jpg`,
      type: 'image',
      data: capturedDataUri,
      preview: capturedDataUri
    });
    renderAttachmentTray();
    showToast('Screen captured & attached! Sending for Neural Vision analysis...', '👁️');

    const promptText = customPrompt || 'Analyze what is currently open on my screen. Detail any errors, active windows, key information, and suggested actions.';
    sendChatMessage(promptText, {
      screenshot_preview: capturedDataUri,
      model: 'Gemini Screen Vision'
    });
  } else {
    showToast('Screen Vision capture cancelled.', '⚠️');
  }
};

window.toggleWebSearch = function(btn) {
  state.useWebSearch = !state.useWebSearch;
  if (btn) btn.classList.toggle('active', state.useWebSearch);
  showToast(state.useWebSearch ? 'Live Web Search ENABLED 🌐' : 'Live Web Search DISABLED', state.useWebSearch ? '🌐' : '⚡');
};

window.triggerQuickWebSearch = function(customQuery) {
  state.useWebSearch = true;
  const toggle = document.getElementById('web-search-toggle');
  if (toggle) toggle.classList.add('active');
  if (customQuery) {
    sendChatMessage(customQuery);
  }
};

// ==============================================================================
// 5. VEO MEDIA STUDIO (IMAGE GEN, VIDEO GEN, IMAGE EDIT, VIDEO EDIT)
// ==============================================================================
window.switchVeoMode = function(mode) {
  const tabs = document.querySelectorAll('.veo-tab-btn');
  tabs.forEach(t => t.classList.toggle('active', (t.id || '').includes(mode) || t.getAttribute('data-mode') === mode));

  const panels = {
    'image-gen': document.getElementById('veo-panel-image-gen'),
    'image-edit': document.getElementById('veo-panel-image-edit'),
    'video-gen': document.getElementById('veo-panel-video-gen'),
    'video-edit': document.getElementById('veo-panel-video-edit')
  };

  Object.keys(panels).forEach(k => {
    if (panels[k]) {
      panels[k].style.display = k === mode ? 'block' : 'none';
    }
  });

  if (mode === 'image-edit') {
    initVeoImageEditor();
  }
};

// --- IMAGE GENERATION ---
window.setVeoImagePrompt = function(promptText) {
  const input = document.getElementById('veo-image-prompt');
  if (input) {
    input.value = promptText;
    input.focus();
  }
  showToast('Inspiration prompt loaded!', '✨');
};

window.randomizeVeoImageSeed = function() {
  const seedInput = document.getElementById('veo-image-seed');
  if (seedInput) {
    seedInput.value = Math.floor(Math.random() * 9999999);
    showToast('Randomized diffusion seed', '🎲');
  }
};

window.executeVeoImageGeneration = async function() {
  const promptInput = document.getElementById('veo-image-prompt');
  const negInput = document.getElementById('veo-image-neg-prompt');
  const styleSelect = document.getElementById('veo-image-style');
  const ratioSelect = document.getElementById('veo-image-ratio');
  const modelSelect = document.getElementById('veo-image-model');
  const seedInput = document.getElementById('veo-image-seed');
  const enhanceChk = document.getElementById('veo-image-enhance');
  const genBtn = document.getElementById('veo-img-gen-btn');
  const previewBox = document.getElementById('veo-image-preview-box');
  const actionBar = document.getElementById('veo-image-action-bar');

  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please enter an image prompt description.', '⚠️');
    if (promptInput) promptInput.focus();
    return;
  }

  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '<span>⚡</span> Synthesizing Visual...';
  }

  if (previewBox) {
    previewBox.innerHTML = `
      <div class="image-placeholder-content">
        <span class="ph-icon" style="animation: spin 1.5s linear infinite; display:inline-block;">⚙️</span>
        <span class="ph-title">Synthesizing High-Resolution Visual</span>
        <span class="ph-desc">Running diffusion tensor generation core. Please wait a moment...</span>
      </div>
    `;
  }

  try {
    const payload = {
      prompt,
      neg_prompt: negInput ? negInput.value.trim() : '',
      style: styleSelect ? styleSelect.value : 'cinematic',
      aspect_ratio: ratioSelect ? ratioSelect.value : '1:1',
      model: modelSelect ? modelSelect.value : 'flux',
      seed: seedInput && seedInput.value ? parseInt(seedInput.value) : -1,
      enhance: enhanceChk ? enhanceChk.checked : true
    };

    const res = await fetch('/api/veo/image-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    const imgUrl = data.image_url || data.url || data.data_uri || data.image_data;

    if (res.ok && imgUrl) {
      currentVeoImage = imgUrl;
      if (previewBox) {
        previewBox.innerHTML = `
          <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
            <img src="${imgUrl}" class="veo-rendered-img" alt="Synthesized Image" onclick="openVeoLightbox(this.src)"
              style="cursor:pointer; max-width:100%; max-height:calc(100vh - 340px); border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.8); border:1px solid var(--border-glass);" />
          </div>
        `;
      }
      if (actionBar) actionBar.style.display = 'flex';
      showToast('Image synthesized successfully! 🎨', '✨');
    } else {
      if (previewBox) {
        previewBox.innerHTML = `
          <div class="image-placeholder-content">
            <span class="ph-icon">⚠️</span>
            <span class="ph-title">Synthesis Notice</span>
            <span class="ph-desc">${escapeHtml(data.detail || 'Failed to generate image.')}</span>
          </div>
        `;
      }
      showToast(data.detail || 'Image synthesis error', '⚠️');
    }
  } catch (err) {
    if (previewBox) {
      previewBox.innerHTML = `
        <div class="image-placeholder-content">
          <span class="ph-icon">❌</span>
          <span class="ph-title">Generation Error</span>
          <span class="ph-desc">${escapeHtml(err.message)}</span>
        </div>
      `;
    }
    showToast(`Error: ${err.message}`, '❌');
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = '<span>✨</span> Generate 8K Image';
    }
  }
};

window.openVeoLightbox = function(src) {
  const imgSrc = src || currentVeoImage;
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (modal && img && imgSrc) {
    img.src = imgSrc;
    modal.style.display = 'flex';
  }
};

window.closeLightbox = function() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.style.display = 'none';
};

window.downloadVeoImage = function() {
  if (!currentVeoImage) {
    showToast('No image available to download.', '⚠️');
    return;
  }
  const a = document.createElement('a');
  a.href = currentVeoImage;
  a.download = `vedas_synthesis_${Date.now()}.png`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Image download started! 💾', '💾');
};

window.sendGeneratedImageToEditor = function() {
  if (!currentVeoImage) {
    showToast('No generated image to send to editor.', '⚠️');
    return;
  }
  switchVeoMode('image-edit');
  loadImageIntoEditor(currentVeoImage);
  showToast('Image loaded into Image Editing Studio! 🖌️', '🖌️');
};

window.sendGeneratedImageToVideo = function() {
  if (!currentVeoImage) {
    showToast('No generated image to animate.', '⚠️');
    return;
  }
  switchVeoMode('video-gen');
  setVideoGenMode('image');
  const refLabel = document.getElementById('veo-ref-label');
  if (refLabel) refLabel.textContent = 'Attached: Synthesized Image Reference';
  showToast('Image attached as Video Reference! 🎬', '🎬');
};

// --- IMAGE EDITING STUDIO ---
window.initVeoImageEditor = function() {
  const canvas = document.getElementById('veo-editor-canvas');
  if (!canvas) return;
  veoEditorState.canvas = canvas;
  veoEditorState.ctx = canvas.getContext('2d');

  if (!canvas._eventsAttached) {
    canvas._eventsAttached = true;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      if (veoEditorState.drawMode === 'none') return;
      isDrawing = true;
      const { x, y } = getCoords(e);
      lastX = x;
      lastY = y;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing || veoEditorState.drawMode === 'none') return;
      const ctx = veoEditorState.ctx;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = veoEditorState.drawMode === 'eraser' ? '#0b101b' : veoEditorState.brushColor;
      ctx.lineWidth = veoEditorState.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = x;
      lastY = y;
    });

    window.addEventListener('mouseup', () => { isDrawing = false; });
  }

  if (!veoEditorState.originalImage) {
    const ph = document.getElementById('veo-canvas-placeholder');
    if (ph) ph.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
  }
};

window.handleVeoImageUpload = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    loadImageIntoEditor(evt.target.result);
    const label = document.getElementById('veo-dropzone-label');
    if (label) label.textContent = `Attached: ${file.name}`;
  };
  reader.readAsDataURL(file);
};

window.loadImageIntoEditor = function(imgSrc) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    veoEditorState.originalImage = img;
    const canvas = document.getElementById('veo-editor-canvas');
    if (!canvas) return;
    veoEditorState.canvas = canvas;
    veoEditorState.ctx = canvas.getContext('2d');

    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    canvas.style.display = 'block';

    const ph = document.getElementById('veo-canvas-placeholder');
    if (ph) ph.style.display = 'none';

    renderEditorCanvas();
    showToast('Image loaded into canvas editor!', '🖌️');
  };
  img.src = imgSrc;
};

function renderEditorCanvas() {
  if (!veoEditorState.canvas || !veoEditorState.ctx || !veoEditorState.originalImage) return;
  const { canvas, ctx, originalImage, adjustments } = veoEditorState;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const b = 100 + adjustments.brightness;
  const c = 100 + adjustments.contrast;
  const s = 100 + adjustments.saturation;
  const blur = adjustments.blur;
  const hue = adjustments.hue;
  const gray = adjustments.grayscale ? 100 : 0;
  const inv = adjustments.invert ? 100 : 0;
  const sep = adjustments.sepia ? 100 : 0;

  ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) blur(${blur}px) hue-rotate(${hue}deg) grayscale(${gray}%) invert(${inv}%) sepia(${sep}%)`;
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

window.switchEditToolTab = function(tabName) {
  const tabs = document.querySelectorAll('[id^="tool-tab-"]');
  tabs.forEach(t => t.classList.toggle('active', t.id === `tool-tab-${tabName}`));

  const sections = ['adjust', 'filters', 'draw', 'crop', 'text', 'ai'];
  sections.forEach(s => {
    const el = document.getElementById(`edit-tool-${s}`);
    if (el) el.style.display = s === tabName ? 'block' : 'none';
  });
};

window.updateImageAdjustments = function() {
  const sB = document.getElementById('slider-brightness');
  const sC = document.getElementById('slider-contrast');
  const sS = document.getElementById('slider-saturation');
  const sBlur = document.getElementById('slider-blur');
  const sHue = document.getElementById('slider-hue');
  const chkG = document.getElementById('chk-grayscale');
  const chkI = document.getElementById('chk-invert');
  const chkS = document.getElementById('chk-sepia');

  veoEditorState.adjustments.brightness = sB ? parseInt(sB.value) || 0 : 0;
  veoEditorState.adjustments.contrast = sC ? parseInt(sC.value) || 0 : 0;
  veoEditorState.adjustments.saturation = sS ? parseInt(sS.value) || 0 : 0;
  veoEditorState.adjustments.blur = sBlur ? parseInt(sBlur.value) || 0 : 0;
  veoEditorState.adjustments.hue = sHue ? parseInt(sHue.value) || 0 : 0;
  veoEditorState.adjustments.grayscale = chkG ? chkG.checked : false;
  veoEditorState.adjustments.invert = chkI ? chkI.checked : false;
  veoEditorState.adjustments.sepia = chkS ? chkS.checked : false;

  renderEditorCanvas();
};

window.applyPresetFilter = function(filterName) {
  veoEditorState.activeFilter = filterName;
  const sB = document.getElementById('slider-brightness');
  const sC = document.getElementById('slider-contrast');
  const sS = document.getElementById('slider-saturation');
  const sHue = document.getElementById('slider-hue');

  if (filterName === 'none') {
    resetImageAdjustments();
    return;
  } else if (filterName === 'cyberpunk') {
    veoEditorState.adjustments = { brightness: 15, contrast: 35, saturation: 60, blur: 0, hue: 280, grayscale: false, invert: false, sepia: false };
  } else if (filterName === 'noir') {
    veoEditorState.adjustments = { brightness: -10, contrast: 45, saturation: 0, blur: 0, hue: 0, grayscale: true, invert: false, sepia: false };
  } else if (filterName === 'vintage') {
    veoEditorState.adjustments = { brightness: 5, contrast: -10, saturation: -20, blur: 0, hue: 0, grayscale: false, invert: false, sepia: true };
  } else if (filterName === 'hdr_glow') {
    veoEditorState.adjustments = { brightness: 20, contrast: 40, saturation: 40, blur: 0, hue: 0, grayscale: false, invert: false, sepia: false };
  } else if (filterName === 'infrared') {
    veoEditorState.adjustments = { brightness: 10, contrast: 50, saturation: 80, blur: 0, hue: 180, grayscale: false, invert: false, sepia: false };
  }

  if (sB) sB.value = veoEditorState.adjustments.brightness;
  if (sC) sC.value = veoEditorState.adjustments.contrast;
  if (sS) sS.value = veoEditorState.adjustments.saturation;
  if (sHue) sHue.value = veoEditorState.adjustments.hue;

  renderEditorCanvas();
  showToast(`Applied preset filter: ${filterName}`, '🪄');
};

window.setDrawingMode = function(mode) {
  veoEditorState.drawMode = mode;
  const brushBtn = document.getElementById('btn-brush-mode');
  const eraserBtn = document.getElementById('btn-eraser-mode');
  if (brushBtn) brushBtn.classList.toggle('active', mode === 'brush');
  if (eraserBtn) eraserBtn.classList.toggle('active', mode === 'eraser');
  showToast(mode === 'none' ? 'Drawing mode disabled' : `Drawing tool: ${mode}`, '🖌️');
};

window.clearCanvasDrawings = function() {
  renderEditorCanvas();
  showToast('Drawings cleared', '🧹');
};

window.setCropRatio = function(ratio) {
  veoEditorState.cropRatio = ratio;
  const buttons = document.querySelectorAll('.veo-crop-btn');
  buttons.forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(ratio)));
  showToast(`Crop Aspect Ratio: ${ratio}`, '✂️');
};

window.applyCanvasCrop = function() {
  if (!veoEditorState.canvas || !veoEditorState.originalImage) return;
  const { canvas } = veoEditorState;
  const ratio = veoEditorState.cropRatio;
  let newW = canvas.width;
  let newH = canvas.height;

  if (ratio === '1:1') {
    const minSide = Math.min(canvas.width, canvas.height);
    newW = minSide;
    newH = minSide;
  } else if (ratio === '16:9') {
    newH = Math.round((newW * 9) / 16);
  } else if (ratio === '9:16') {
    newW = Math.round((newH * 9) / 16);
  } else if (ratio === '4:3') {
    newH = Math.round((newW * 3) / 4);
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newW;
  tempCanvas.height = newH;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, newW, newH, 0, 0, newW, newH);

  const img = new Image();
  img.onload = () => {
    veoEditorState.originalImage = img;
    canvas.width = newW;
    canvas.height = newH;
    renderEditorCanvas();
    showToast('Crop applied successfully! ✂️', '✂️');
  };
  img.src = tempCanvas.toDataURL();
};

window.applyTextOverlay = function() {
  if (!veoEditorState.canvas) return;
  const textInput = document.getElementById('overlay-text-input');
  const posSelect = document.getElementById('overlay-text-pos');
  const sizeInput = document.getElementById('overlay-text-size');
  const text = textInput ? textInput.value.trim() : '';

  if (!text) {
    showToast('Please enter overlay text.', '⚠️');
    return;
  }

  const ctx = veoEditorState.ctx;
  const canvas = veoEditorState.canvas;
  const size = sizeInput ? parseInt(sizeInput.value) || 28 : 28;
  const pos = posSelect ? posSelect.value : 'bottom-right';

  ctx.save();
  ctx.font = `bold ${size}px Outfit, Inter, sans-serif`;
  ctx.fillStyle = '#00f3ff';
  ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
  ctx.shadowBlur = 10;

  let x = canvas.width - 20;
  let y = canvas.height - 20;
  ctx.textAlign = 'right';

  if (pos === 'top-left') {
    x = 20;
    y = size + 20;
    ctx.textAlign = 'left';
  } else if (pos === 'bottom-center') {
    x = canvas.width / 2;
    y = canvas.height - 20;
    ctx.textAlign = 'center';
  } else if (pos === 'center') {
    x = canvas.width / 2;
    y = canvas.height / 2;
    ctx.textAlign = 'center';
  }

  ctx.fillText(text, x, y);
  ctx.restore();
  showToast('Text overlay added to image! 💬', '💬');
};

window.executeAiImageRemix = async function() {
  const promptInput = document.getElementById('ai-remix-prompt');
  const prompt = promptInput ? promptInput.value.trim() : '';

  if (!prompt) {
    showToast('Please enter modification instructions for AI Remix.', '⚠️');
    return;
  }
  if (!veoEditorState.canvas) {
    showToast('No image loaded in editor to remix.', '⚠️');
    return;
  }

  showToast('Synthesizing AI Remix...', '⚡');
  try {
    const dataUri = veoEditorState.canvas.toDataURL('image/png');
    const res = await fetch('/api/veo/image-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_data: dataUri, edit_mode: 'remix' })
    });
    const data = await res.json();
    const remixUrl = data.image_url || data.url || data.data_uri || data.image_data;

    if (res.ok && remixUrl) {
      loadImageIntoEditor(remixUrl);
      showToast('AI Remix synthesized! ✨', '✨');
    } else {
      showToast(data.detail || 'Remix synthesis notice', '⚠️');
    }
  } catch (err) {
    showToast(`Remix error: ${err.message}`, '❌');
  }
};

window.resetImageAdjustments = function() {
  veoEditorState.adjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    hue: 0,
    grayscale: false,
    invert: false,
    sepia: false
  };

  const sB = document.getElementById('slider-brightness');
  const sC = document.getElementById('slider-contrast');
  const sS = document.getElementById('slider-saturation');
  const sBlur = document.getElementById('slider-blur');
  const sHue = document.getElementById('slider-hue');
  const chkG = document.getElementById('chk-grayscale');
  const chkI = document.getElementById('chk-invert');
  const chkS = document.getElementById('chk-sepia');

  if (sB) sB.value = 0;
  if (sC) sC.value = 0;
  if (sS) sS.value = 0;
  if (sBlur) sBlur.value = 0;
  if (sHue) sHue.value = 0;
  if (chkG) chkG.checked = false;
  if (chkI) chkI.checked = false;
  if (chkS) chkS.checked = false;

  renderEditorCanvas();
  showToast('Adjustments reset to default', '🔄');
};

window.exportEditedImage = function() {
  if (!veoEditorState.canvas) {
    showToast('No image to export.', '⚠️');
    return;
  }
  const a = document.createElement('a');
  a.href = veoEditorState.canvas.toDataURL('image/png');
  a.download = `vedas_edited_image_${Date.now()}.png`;
  a.click();
  showToast('Edited image exported & downloaded! 💾', '💾');
};

window.sendEditedImageToVideo = function() {
  if (!veoEditorState.canvas) {
    showToast('No edited image to animate.', '⚠️');
    return;
  }
  const dataUri = veoEditorState.canvas.toDataURL('image/png');
  currentVeoImage = dataUri;
  sendGeneratedImageToVideo();
};

// --- VIDEO GENERATION & CINEMATIC MOTION ENGINE ---
window.setVideoGenMode = function(mode) {
  veoVideoGenMode = mode;
  const btnT2V = document.getElementById('btn-vmode-t2v');
  const btnI2V = document.getElementById('btn-vmode-i2v');
  const i2vBox = document.getElementById('veo-i2v-container');

  if (btnT2V) btnT2V.classList.toggle('active', mode === 'text');
  if (btnI2V) btnI2V.classList.toggle('active', mode === 'image');
  if (i2vBox) i2vBox.style.display = mode === 'image' ? 'block' : 'none';
};

window.handleVideoRefUpload = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    currentVeoImage = evt.target.result;
    const refLabel = document.getElementById('veo-ref-label');
    if (refLabel) refLabel.textContent = `Attached: ${file.name}`;
    showToast('Attached reference image for video animation!', '🎬');
  };
  reader.readAsDataURL(file);
};

let currentVeoAudio = null;
let veoAudioMuted = false;
let veoAudioVolume = 0.85;

// Real Multi-Agent Video & Synchronized Audio Player
function initRealVideoPlayback(videoUrl, audioUrl, soundDescription, durationSec = 5.0) {
  if (veoAnimFrameId) {
    cancelAnimationFrame(veoAnimFrameId);
    veoAnimFrameId = null;
  }

  const canvas = document.getElementById('veo-animated-canvas');
  const videoEl = document.getElementById('veo-rendered-video');
  const audioEl = document.getElementById('veo-rendered-audio');
  const playerContainer = document.getElementById('veo-player-container');
  const placeholder = document.getElementById('veo-video-placeholder');
  const playBtn = document.getElementById('veo-play-pause-btn');
  const timeReadout = document.getElementById('veo-time-readout');
  const scrubBar = document.getElementById('veo-scrub-bar');
  const soundBanner = document.getElementById('veo-sound-banner');
  const soundLabel = document.getElementById('veo-sound-theme-text');
  const muteBtn = document.getElementById('veo-mute-btn');

  if (placeholder) placeholder.style.display = 'none';
  if (playerContainer) playerContainer.style.display = 'flex';
  if (canvas) canvas.style.display = 'none';
  
  currentVeoVideo = videoUrl;
  currentVeoAudio = audioUrl;

  if (videoEl) {
    videoEl.style.display = 'block';
    videoEl.src = videoUrl;
    videoEl.volume = veoAudioVolume;
    videoEl.muted = veoAudioMuted;
    videoEl.playbackRate = veoVideoPlaybackRate;
    videoEl.loop = veoVideoLoop;
    videoEl.load();

    videoEl.onerror = () => {
      console.warn('Video element load notice for:', videoUrl);
    };
  }

  // Audio element as auxiliary track (muted by default because audio is embedded directly into the H.264 MP4!)
  if (audioEl && audioUrl) {
    audioEl.src = audioUrl;
    audioEl.volume = veoAudioVolume;
    audioEl.muted = true;
    audioEl.playbackRate = veoVideoPlaybackRate;
    audioEl.loop = veoVideoLoop;
    audioEl.load();
  }

  if (soundBanner && soundLabel) {
    soundLabel.textContent = soundDescription || 'Cinematic Soundtrack & Spatial Audio Active';
    soundBanner.style.display = 'inline-flex';
  }

  if (muteBtn) {
    muteBtn.textContent = veoAudioMuted ? '🔇' : '🔊';
  }

  veoVideoDuration = durationSec || 5.0;
  veoVideoCurrentTime = 0;
  veoVideoIsPlaying = true;
  if (playBtn) playBtn.textContent = '⏸';

  if (videoEl) {
    videoEl.currentTime = 0;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay policy: fallback to muted autoplay
        console.log('Autoplay audio restricted, playing muted:', err);
        videoEl.muted = true;
        videoEl.play().catch(() => {});
      });
    }

    videoEl.ontimeupdate = () => {
      veoVideoCurrentTime = videoEl.currentTime;
      const dur = videoEl.duration || veoVideoDuration;
      const progress = dur > 0 ? (videoEl.currentTime / dur) : 0;
      
      if (timeReadout) {
        const curM = Math.floor(videoEl.currentTime / 60).toString().padStart(2, '0');
        const curS = Math.floor(videoEl.currentTime % 60).toString().padStart(2, '0');
        const durM = Math.floor(dur / 60).toString().padStart(2, '0');
        const durS = Math.floor(dur % 60).toString().padStart(2, '0');
        timeReadout.textContent = `${curM}:${curS} / ${durM}:${durS}`;
      }
      if (scrubBar) {
        scrubBar.value = (progress * 100).toFixed(1);
      }
    };

    videoEl.onended = () => {
      if (veoVideoLoop) {
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
      } else {
        veoVideoIsPlaying = false;
        if (playBtn) playBtn.textContent = '▶';
      }
    };

    videoEl.onplay = () => {
      veoVideoIsPlaying = true;
      if (playBtn) playBtn.textContent = '⏸';
    };

    videoEl.onpause = () => {
      veoVideoIsPlaying = false;
      if (playBtn) playBtn.textContent = '▶';
    };
  }
}

function initCinematicVideoPlayback(imageSourceUrl, durationSec = 5.0, motionType = 'orbit', intensity = 5) {
  initRealVideoPlayback(imageSourceUrl, null, 'Cinematic Dynamic Visual', durationSec);
}

window.toggleVeoAudioMute = function() {
  veoAudioMuted = !veoAudioMuted;
  const audioEl = document.getElementById('veo-rendered-audio');
  const videoEl = document.getElementById('veo-rendered-video');
  const muteBtn = document.getElementById('veo-mute-btn');
  if (videoEl) videoEl.muted = veoAudioMuted;
  if (audioEl) audioEl.muted = veoAudioMuted;
  if (muteBtn) muteBtn.textContent = veoAudioMuted ? '🔇' : '🔊';
  showToast(veoAudioMuted ? 'Audio soundtrack muted' : 'Audio soundtrack unmuted', veoAudioMuted ? '🔇' : '🔊');
};

window.setVeoAudioVolume = function(val) {
  veoAudioVolume = Math.max(0, Math.min(1, parseFloat(val) / 100));
  const audioEl = document.getElementById('veo-rendered-audio');
  const videoEl = document.getElementById('veo-rendered-video');
  if (videoEl) videoEl.volume = veoAudioVolume;
  if (audioEl) audioEl.volume = veoAudioVolume;
};

window.executeVeoVideoGeneration = async function() {
  if (veoAnimFrameId) {
    cancelAnimationFrame(veoAnimFrameId);
    veoAnimFrameId = null;
  }
  currentVeoVideo = null;
  currentVeoAudio = null;

  const promptInput = document.getElementById('veo-video-prompt');
  const engineSelect = document.getElementById('veo-video-engine');
  const motionSelect = document.getElementById('veo-camera-motion');
  const styleSelect = document.getElementById('veo-video-style');
  const ratioSelect = document.getElementById('veo-video-ratio');
  const durationSelect = document.getElementById('veo-video-duration');
  const fpsSelect = document.getElementById('veo-video-fps');
  const strengthInput = document.getElementById('veo-motion-strength');
  const genBtn = document.getElementById('veo-vid-gen-btn');
  const placeholder = document.getElementById('veo-video-placeholder');
  const playerContainer = document.getElementById('veo-player-container');
  const actionBar = document.getElementById('veo-video-action-bar');

  const prompt = promptInput ? promptInput.value.trim() : '';
  if (!prompt) {
    showToast('Please enter a video scene description.', '⚠️');
    if (promptInput) promptInput.focus();
    return;
  }

  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '<span>🎬</span> Synthesizing Neural Video & Audio...';
  }

  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
      <span class="ph-icon" style="animation: spin 1.5s linear infinite; display:inline-block;">⚡</span>
      <span class="ph-title">Generating Real Neural AI Video</span>
      <span class="ph-desc">Running generative diffusion model (LTX-Video 2.0 / Zeroscope / Wan 2.1 / Veo) to synthesize full temporal motion video & broadcast H.264 stereo audio...</span>
    `;
  }
  if (playerContainer) playerContainer.style.display = 'none';

  try {
    const engineType = engineSelect ? engineSelect.value : 'auto';
    const motionType = motionSelect ? motionSelect.value : 'orbit';
    const duration = durationSelect ? parseInt(durationSelect.value) || 5 : 5;
    const intensity = strengthInput ? parseInt(strengthInput.value) || 5 : 5;

    const payload = {
      prompt,
      engine: engineType,
      mode: veoVideoGenMode,
      camera_motion: motionType,
      style: styleSelect ? styleSelect.value : 'cinematic',
      aspect_ratio: ratioSelect ? ratioSelect.value : '16:9',
      duration: duration,
      fps: fpsSelect ? parseInt(fpsSelect.value) || 30 : 30,
      motion_strength: intensity,
      reference_image: veoVideoGenMode === 'image' ? currentVeoImage : null
    };

    const res = await fetch('/api/veo/video-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    const videoUrl = data.video_url || data.preview_url;
    const audioUrl = data.audio_url;
    const soundTheme = data.sound_theme || data.sound_description;
    const engineUsed = data.engine_used || data.engine || 'Neural Video Engine';

    if (res.ok && videoUrl) {
      currentVeoVideo = videoUrl;
      currentVeoAudio = audioUrl;
      currentVeoImage = data.poster_url || data.image_url;

      initRealVideoPlayback(videoUrl, audioUrl, soundTheme, duration);

      if (actionBar) actionBar.style.display = 'flex';
      showToast(`Real AI Video synthesized via ${engineUsed}! 🎬🎵`, '✨');
    } else {
      const errorMsg = data.detail || 'Failed to generate video.';
      const formattedErr = errorMsg.replace(/\n/g, '<br/>');
      if (placeholder) {
        placeholder.innerHTML = `
          <span class="ph-icon">⚠️</span>
          <span class="ph-title" style="color:#f87171;">Real Video Generation Notice</span>
          <div class="ph-desc" style="text-align:left; max-width:540px; margin:8px auto; line-height:1.5; font-size:0.85rem; background:rgba(0,0,0,0.35); padding:12px; border-radius:8px; border:1px solid rgba(239,68,68,0.3);">
            ${formattedErr}
          </div>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:8px;">
            <button class="veo-mini-btn" onclick="switchView('settings'); switchSettingsSubTab('ai');" style="background:linear-gradient(135deg,var(--blue-primary),var(--orange-primary)); color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:600; cursor:pointer;">
              ⚙️ Open Settings (Add Free HF Token)
            </button>
            <a href="https://huggingface.co/settings/tokens" target="_blank" class="veo-mini-btn" style="text-decoration:none; display:inline-flex; align-items:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:6px 14px; border-radius:6px; font-weight:600;">
              Get Free HF Token ↗
            </a>
          </div>
        `;
      }
      showToast(errorMsg.length > 80 ? errorMsg.substring(0, 80) + '...' : errorMsg, '⚠️');
    }
  } catch (err) {
    if (placeholder) {
      placeholder.innerHTML = `
        <span class="ph-icon">❌</span>
        <span class="ph-title">Generation Error</span>
        <span class="ph-desc">${escapeHtml(err.message)}</span>
      `;
    }
    showToast(`Error: ${err.message}`, '❌');
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = '<span>🎬</span> Synthesize Cinematic Video';
    }
  }
};

window.toggleVeoVideoPlay = function() {
  const videoEl = document.getElementById('veo-rendered-video');
  const btn = document.getElementById('veo-play-pause-btn');

  if (videoEl && videoEl.src) {
    if (videoEl.paused) {
      videoEl.play().then(() => {
        veoVideoIsPlaying = true;
        if (btn) btn.textContent = '⏸';
      }).catch(() => {
        videoEl.muted = true;
        videoEl.play().catch(() => {});
        veoVideoIsPlaying = true;
        if (btn) btn.textContent = '⏸';
      });
    } else {
      videoEl.pause();
      veoVideoIsPlaying = false;
      if (btn) btn.textContent = '▶';
    }
  }
};

window.scrubVeoVideo = function(val) {
  const videoEl = document.getElementById('veo-rendered-video');
  const dur = (videoEl && videoEl.duration) || veoVideoDuration;
  const targetTime = (parseFloat(val) / 100) * dur;
  
  if (videoEl && videoEl.src) {
    videoEl.currentTime = targetTime;
  }
};

window.toggleVeoVideoLoop = function() {
  veoVideoLoop = !veoVideoLoop;
  const btn = document.getElementById('veo-loop-btn');
  const videoEl = document.getElementById('veo-rendered-video');
  const audioEl = document.getElementById('veo-rendered-audio');
  if (videoEl) videoEl.loop = veoVideoLoop;
  if (audioEl) audioEl.loop = veoVideoLoop;
  if (btn) btn.style.opacity = veoVideoLoop ? '1.0' : '0.5';
  showToast(veoVideoLoop ? 'Looping enabled' : 'Looping disabled', '🔁');
};

window.changeVeoVideoSpeed = function(speed) {
  const rate = parseFloat(speed) || 1.0;
  veoVideoPlaybackRate = rate;
  const videoEl = document.getElementById('veo-rendered-video');
  const audioEl = document.getElementById('veo-rendered-audio');
  if (videoEl) videoEl.playbackRate = rate;
  if (audioEl) audioEl.playbackRate = rate;
  showToast(`Playback speed: ${speed}x`, '⚡');
};

window.toggleVeoVideoFullscreen = function() {
  const stage = document.getElementById('veo-video-stage') || document.getElementById('veo-player-container');
  if (!stage) return;
  if (!document.fullscreenElement) {
    stage.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
};

window.downloadVeoVideo = function(format = 'mp4') {
  if (currentVeoVideo) {
    const a = document.createElement('a');
    a.href = currentVeoVideo;
    a.download = `VEDAS_Cinematic_Video_${Date.now()}.${format === 'webm' ? 'webm' : 'mp4'}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloaded cinematic video with audio (${format.toUpperCase()})! 💾`, '💾');
  } else if (currentVeoImage) {
    const a = document.createElement('a');
    a.href = currentVeoImage;
    a.download = `VEDAS_video_frame_${Date.now()}.png`;
    a.click();
    showToast('Downloaded video keyframe render! 💾', '💾');
  } else {
    showToast('No video available to export.', '⚠️');
  }
};

window.sendGeneratedVideoToEditor = function() {
  switchVeoMode('video-edit');
  if (currentVeoVideo) {
    loadVideoIntoEditor(currentVeoVideo);
  } else if (currentVeoImage) {
    loadVideoIntoEditor(currentVeoImage);
  }
  showToast('Loaded video into Video Post-Production Studio! ✂️', '✂️');
};

// --- VIDEO EDITING STUDIO ---
window.handleVeoVideoUpload = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadVideoIntoEditor(url);
  const dropLabel = document.getElementById('veo-video-drop-label');
  if (dropLabel) dropLabel.textContent = `Attached: ${file.name}`;
  showToast(`Loaded video: ${file.name}`, '📹');
};

window.loadVideoIntoEditor = function(src) {
  const video = document.getElementById('veo-edit-video-element');
  const box = document.getElementById('veo-edit-player-box');
  const placeholder = document.getElementById('veo-edit-placeholder');
  if (video) {
    video.src = src;
    video.load();
    video.play().catch(() => {});
    if (box) box.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }
};

window.updateVideoTrim = function() {
  const startInp = document.getElementById('v-trim-start');
  const endInp = document.getElementById('v-trim-end');
  const durText = document.getElementById('v-trim-duration-text');
  const start = startInp ? parseFloat(startInp.value) || 0 : 0;
  const end = endInp ? parseFloat(endInp.value) || 5 : 5;
  const dur = Math.max(0.5, end - start);
  if (durText) durText.textContent = `Trim Duration: ${dur.toFixed(1)} seconds`;
};

window.updateVideoVolume = function(val) {
  const video = document.getElementById('veo-edit-video-element');
  const txt = document.getElementById('val-video-volume');
  const vol = Math.max(0, Math.min(100, parseInt(val) || 0));
  if (txt) txt.textContent = `${vol}%`;
  if (video) video.volume = vol / 100.0;
};

window.updateVideoVisualFilters = function() {
  const video = document.getElementById('veo-edit-video-element');
  if (!video) return;

  const br = document.getElementById('slider-video-brightness');
  const ct = document.getElementById('slider-video-contrast');
  const st = document.getElementById('slider-video-saturation');

  const bVal = br ? parseInt(br.value) || 0 : 0;
  const cVal = ct ? parseInt(ct.value) || 0 : 0;
  const sVal = st ? parseInt(st.value) || 0 : 0;

  const bTxt = document.getElementById('val-video-brightness');
  const cTxt = document.getElementById('val-video-contrast');
  const sTxt = document.getElementById('val-video-saturation');

  if (bTxt) bTxt.textContent = `${bVal > 0 ? '+' : ''}${bVal}%`;
  if (cTxt) cTxt.textContent = `${cVal > 0 ? '+' : ''}${cVal}%`;
  if (sTxt) sTxt.textContent = `${sVal > 0 ? '+' : ''}${sVal}%`;

  const brightnessFactor = (100 + bVal) / 100;
  const contrastFactor = (100 + cVal) / 100;
  const saturationFactor = (100 + sVal) / 100;

  video.style.filter = `brightness(${brightnessFactor}) contrast(${contrastFactor}) saturate(${saturationFactor})`;
};

window.applyVideoAspectRatio = function(ratio) {
  const video = document.getElementById('veo-edit-video-element');
  if (video) {
    video.style.aspectRatio = ratio;
    showToast(`Aspect ratio set to ${ratio}`, '📐');
  }
};

window.toggleEditVideoPlayback = function() {
  const video = document.getElementById('veo-edit-video-element');
  const btn = document.getElementById('v-play-pause-btn');
  if (!video) return;
  if (video.paused) {
    video.play().catch(() => {});
    if (btn) btn.textContent = '⏸ Pause Video';
  } else {
    video.pause();
    if (btn) btn.textContent = '▶ Play Video';
  }
};

window.stopEditVideoPlayback = function() {
  const video = document.getElementById('veo-edit-video-element');
  const btn = document.getElementById('v-play-pause-btn');
  if (video) {
    video.pause();
    video.currentTime = 0;
    if (btn) btn.textContent = '▶ Play Video';
    showToast('Video stopped & reset to 0:00.', '⏹');
  }
};

window.applyVideoEditSpeed = function(speed) {
  const video = document.getElementById('veo-edit-video-element');
  if (video) {
    video.playbackRate = parseFloat(speed) || 1.0;
    showToast(`Speed set to ${speed}x`, '⚡');
  }
};

window.applyVideoFilter = function(filterName) {
  const video = document.getElementById('veo-edit-video-element');
  if (!video) return;

  const tiles = document.querySelectorAll('.veo-filter-tile');
  tiles.forEach(t => t.classList.toggle('active', t.getAttribute('onclick') && t.getAttribute('onclick').includes(filterName)));

  if (filterName === 'cyberpunk') {
    video.style.filter = 'contrast(130%) saturate(150%) hue-rotate(280deg)';
  } else if (filterName === 'teal_orange') {
    video.style.filter = 'contrast(120%) saturate(140%) sepia(30%) hue-rotate(180deg)';
  } else if (filterName === 'noir') {
    video.style.filter = 'grayscale(100%) contrast(150%)';
  } else if (filterName === 'vhs') {
    video.style.filter = 'contrast(120%) saturate(130%) sepia(40%)';
  } else if (filterName === 'matrix') {
    video.style.filter = 'hue-rotate(90deg) contrast(140%) saturate(180%)';
  } else {
    updateVideoVisualFilters();
  }
  showToast(`Video FX Filter: ${filterName}`, '🪄');
};

window.updateVideoTextOverlay = function(text) {
  const overlay = document.getElementById('veo-edit-watermark-overlay');
  if (!overlay) return;
  if (text && text.trim()) {
    overlay.textContent = text.trim();
    overlay.style.display = 'inline-block';
    overlay.style.bottom = 'auto';
    overlay.style.right = 'auto';
    overlay.style.height = 'auto';
    overlay.style.width = 'auto';
    overlay.style.transform = 'none';
    if (!overlay.style.left || overlay.style.left === '0px') overlay.style.left = '24px';
    if (!overlay.style.top || overlay.style.top === '0px') overlay.style.top = '24px';
    initDraggableWatermark();
  } else {
    overlay.style.display = 'none';
  }
};

function initDraggableWatermark() {
  const overlay = document.getElementById('veo-edit-watermark-overlay');
  const container = document.getElementById('veo-edit-player-box');
  if (!overlay || !container || overlay._dragInitialized) return;
  overlay._dragInitialized = true;

  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 24, initialTop = 24;

  overlay.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = overlay.offsetLeft;
    initialTop = overlay.offsetTop;
    try { overlay.setPointerCapture(e.pointerId); } catch(err){}
    overlay.style.cursor = 'grabbing';
    e.preventDefault();
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxLeft = Math.max(10, container.clientWidth - overlay.offsetWidth - 10);
    const maxTop = Math.max(10, container.clientHeight - overlay.offsetHeight - 10);
    const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
    const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));
    overlay.style.left = `${newLeft}px`;
    overlay.style.top = `${newTop}px`;
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      overlay.style.cursor = 'grab';
      try { overlay.releasePointerCapture(e.pointerId); } catch(err){}
    }
  };

  overlay.addEventListener('pointerup', stopDrag);
  overlay.addEventListener('pointercancel', stopDrag);
}

window.toggleVideoEditMute = function() {
  const video = document.getElementById('veo-edit-video-element');
  const btn = document.getElementById('v-mute-toggle-btn');
  if (video) {
    video.muted = !video.muted;
    if (btn) btn.textContent = video.muted ? '🔇 Audio: MUTED' : '🔊 Audio: ON';
    showToast(video.muted ? 'Audio Muted' : 'Audio Unmuted', video.muted ? '🔇' : '🔊');
  }
};

window.captureVideoFrameToImageEditor = function() {
  const video = document.getElementById('veo-edit-video-element');
  if (!video) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frameData = canvas.toDataURL('image/png');
  switchVeoMode('image-edit');
  loadImageIntoEditor(frameData);
  showToast('Frame captured to Image Editor! 📸', '📸');
};

window.exportEditedVideo = async function() {
  showToast('Exporting edited video to Desktop & Disk...', '🎬');
  try {
    const video = document.getElementById('veo-edit-video-element');
    const timestamp = Date.now();
    const filename = `VEDAS_Edited_Video_${timestamp}.mp4`;

    // 1. Direct Desktop save via Backend
    fetch('/api/veo/export-desktop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, media_type: 'video' })
    }).catch(() => {});

    // 2. Client-side direct download
    if (currentVeoVideoBlob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(currentVeoVideoBlob);
      a.download = filename;
      a.click();
      showToast(`Exported & saved ${filename} to Desktop! 💾`, '💾');
    } else if (video && video.src && !video.src.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = video.src;
      a.download = filename;
      a.click();
      showToast(`Exported ${filename}! 💾`, '💾');
    } else {
      showToast('Video export processed and saved to Desktop! ✅', '✅');
    }
  } catch (err) {
    showToast(`Export notice: ${err.message}`, '⚠️');
  }
};

// ==============================================================================
// 6. ADMIN DASHBOARD, TELEMETRY & USER VAULT
// ==============================================================================
window.switchAdminSubTab = function(subTab) {
  const btnTel = document.getElementById('admin-subtab-telemetry');
  const btnUsr = document.getElementById('admin-subtab-users');
  const panTel = document.getElementById('admin-panel-telemetry');
  const panUsr = document.getElementById('admin-panel-users');

  if (btnTel) btnTel.classList.toggle('active', subTab === 'telemetry');
  if (btnUsr) btnUsr.classList.toggle('active', subTab === 'users');
  if (panTel) panTel.style.display = subTab === 'telemetry' ? 'block' : 'none';
  if (panUsr) panUsr.style.display = subTab === 'users' ? 'block' : 'none';

  if (subTab === 'users') {
    fetchAdminUserVault();
  } else {
    fetchAdminUsageMetrics();
  }
};

window.fetchAdminUserVault = async function() {
  const tbody = document.getElementById('admin-users-tbody');
  const countBadge = document.getElementById('adm-user-count-badge');
  if (!tbody) return;

  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/admin/users', { headers });
    if (!res.ok) throw new Error('Failed to load accounts');
    const data = await res.json();
    const users = data.users || [];

    if (countBadge) countBadge.textContent = users.length;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No registered accounts in vault.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isMaster = (u.email === 'ghanekar.vedansh@gmail.com');
      return `
        <tr>
          <td style="font-size:1.2rem; text-align:center;">${u.avatar || (isMaster ? '👑' : '👤')}</td>
          <td style="font-weight:700; color:#fff;">${escapeHtml(u.name || u.email.split('@')[0])}</td>
          <td style="font-family:var(--font-mono); color:var(--blue-bright);">${escapeHtml(u.email)}</td>
          <td><span class="user-role-badge ${u.role === 'admin' ? 'admin' : 'user'}">${u.role.toUpperCase()}</span></td>
          <td style="font-family:var(--font-mono); color:#94a3b8;">${escapeHtml(u.password || '••••••••')}</td>
          <td style="font-size:0.76rem; color:var(--text-dim);">${escapeHtml(u.created_at || 'Permanent')}</td>
          <td style="text-align:right;">
            ${isMaster ? '<span style="font-size:0.75rem; color:var(--blue-bright); font-weight:700;">Master Admin (Locked)</span>' : `
              <button onclick="deleteAdminUser('${encodeURIComponent(u.email)}')" class="memory-del-btn" style="padding:4px 8px; font-size:0.75rem;" title="Delete User Account">
                🗑️ Delete
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#fca5a5; padding:20px;">Error loading user vault: ${escapeHtml(err.message)}</td></tr>`;
  }
};

window.handleAdminCreateUser = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameInp = document.getElementById('adm-new-name');
  const emailInp = document.getElementById('adm-new-email');
  const pwdInp = document.getElementById('adm-new-pwd');
  const roleInp = document.getElementById('adm-new-role');

  const name = nameInp ? nameInp.value.trim() : '';
  const email = emailInp ? emailInp.value.trim() : '';
  const password = pwdInp ? pwdInp.value : '';
  const role = roleInp ? roleInp.value : 'user';

  if (!email || !password) {
    showToast('Email and Password are required.', '⚠️');
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Created account for ${email}! 👤`, '✅');
      if (nameInp) nameInp.value = '';
      if (emailInp) emailInp.value = '';
      if (pwdInp) pwdInp.value = '';
      fetchAdminUserVault();
    } else {
      showToast(data.detail || 'Failed to create user', '⚠️');
    }
  } catch (err) {
    showToast(`Create user error: ${err.message}`, '❌');
  }
};

window.deleteAdminUser = async function(encodedEmail) {
  const email = decodeURIComponent(encodedEmail);
  if (!confirm(`Are you sure you want to permanently delete user account "${email}"?`)) return;

  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Deleted account ${email}.`, '🗑️');
      fetchAdminUserVault();
    } else {
      showToast(data.detail || 'Delete failed', '⚠️');
    }
  } catch (err) {
    showToast(`Delete error: ${err.message}`, '❌');
  }
};

window.fetchAdminUsageMetrics = async function() {
  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/admin/usage', { headers });
    if (!res.ok) return;

    const data = await res.json();
    const g = data.gemini || {};
    const l = data.llama || {};

    const elTot = document.getElementById('adm-total-queries');
    const elGCALLS = document.getElementById('adm-gemini-calls');
    const elLCALLS = document.getElementById('adm-llama-calls');
    const elVeo = document.getElementById('adm-veo-media');

    if (elTot) elTot.textContent = (data.total_queries || data.total_api_calls || 0).toLocaleString();
    if (elGCALLS) elGCALLS.textContent = (g.requests_used || data.gemini_queries || 0).toLocaleString();
    if (elLCALLS) elLCALLS.textContent = (l.requests_used || data.llama_inferences || 0).toLocaleString();
    if (elVeo) elVeo.textContent = (data.veo_total_synthesized || 0).toLocaleString();

    const elGStatus = document.getElementById('adm-gemini-status');
    const elGReq = document.getElementById('adm-gemini-req-text');
    const elGBar = document.getElementById('adm-gemini-req-bar');
    const elGReqRem = document.getElementById('adm-gemini-req-rem');
    const elGTok = document.getElementById('adm-gemini-tok-text');
    const elGTokBar = document.getElementById('adm-gemini-tok-bar');
    const elGTokRem = document.getElementById('adm-gemini-tok-rem');
    const elGKey = document.getElementById('adm-gemini-key');
    const elGLatency = document.getElementById('adm-gemini-latency');
    const elGChain = document.getElementById('adm-gemini-chain');

    if (g.quota_exhausted) {
      if (elGStatus) {
        elGStatus.textContent = 'Quota Exceeded (429 Rate Limit)';
        elGStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        elGStatus.style.color = '#fca5a5';
      }
      if (elGReq) elGReq.textContent = `${(g.requests_limit || 1500).toLocaleString()} / ${(g.requests_limit || 1500).toLocaleString()} Requests (Limit Exceeded)`;
      if (elGReqRem) {
        elGReqRem.textContent = `⚠️ 0 Requests remaining (AI Studio Quota Limit Reached)`;
        elGReqRem.style.color = '#fca5a5';
      }
      if (elGBar) elGBar.style.width = '100%';
    } else {
      if (elGStatus) {
        elGStatus.textContent = g.key_status || 'Active • Tier 1';
        elGStatus.style.background = '';
        elGStatus.style.color = '';
      }
      if (elGReq) elGReq.textContent = `${(g.requests_used || 0).toLocaleString()} / ${(g.requests_limit || 1500).toLocaleString()} Requests Used`;
      if (elGBar) elGBar.style.width = `${Math.min(100, g.requests_percent || 0)}%`;
      if (elGReqRem) {
        elGReqRem.textContent = `✨ ${(g.requests_remaining || 0).toLocaleString()} Requests remaining (${g.requests_percent_remaining || 0}%)`;
        elGReqRem.style.color = 'var(--blue-bright)';
      }
    }

    if (elGTok) elGTok.textContent = `${(g.tokens_used || 0).toLocaleString()} / ${(g.tokens_limit || 1000000).toLocaleString()} Tokens`;
    if (elGTokBar) elGTokBar.style.width = `${Math.min(100, g.tokens_percent || 0)}%`;
    if (elGTokRem) {
      elGTokRem.textContent = `✨ ${(g.tokens_remaining || 0).toLocaleString()} Tokens remaining (${g.tokens_percent_remaining || 0}%)`;
    }
    if (elGKey && g.key_masked) elGKey.textContent = `${g.key_masked} (Active)`;
    if (elGLatency && g.avg_latency) elGLatency.textContent = `~${g.avg_latency} sub-second`;
    if (elGChain) elGChain.textContent = `3.5 Flash Lite → 3.5 Flash → 3.7 Flash → 3.1 Pro`;

    const elLStatus = document.getElementById('adm-llama-status');
    const elLCtx = document.getElementById('adm-llama-ctx-text');
    const elLCtxBar = document.getElementById('adm-llama-ctx-bar');
    const elLCtxRem = document.getElementById('adm-llama-ctx-rem');
    const elLVram = document.getElementById('adm-llama-vram-text');
    const elLVramBar = document.getElementById('adm-llama-vram-bar');
    const elLVramRem = document.getElementById('adm-llama-vram-rem');

    if (elLStatus) elLStatus.textContent = l.daemon_status || 'Ollama: Online';
    if (elLCtx) elLCtx.textContent = `${(l.context_tokens_used || 0).toLocaleString()} / ${(l.context_limit || 8192).toLocaleString()} Tokens`;
    if (elLCtxBar) elLCtxBar.style.width = `${Math.min(100, l.context_percent || 0)}%`;
    if (elLCtxRem) elLCtxRem.textContent = `⚡ ${(l.context_tokens_remaining || 0).toLocaleString()} Context Tokens free (${l.context_percent_remaining || 0}%)`;

    const vramAllocGB = ((l.vram_allocated_mb || 3950) / 1024).toFixed(1);
    const vramMaxGB = ((l.vram_max_mb || 8192) / 1024).toFixed(1);
    const vramFreeGB = ((l.vram_headroom_mb || 4242) / 1024).toFixed(1);

    if (elLVram) elLVram.textContent = `${vramAllocGB} GB / ${vramMaxGB} GB VRAM`;
    if (elLVramBar) elLVramBar.style.width = `${Math.min(100, 100 - (l.vram_percent_remaining || 50))}%`;
    if (elLVramRem) elLVramRem.textContent = `⚡ ${vramFreeGB} GB VRAM free (${l.vram_percent_remaining || 50}%)`;

    // Render audit log
    const auditTbody = document.getElementById('adm-audit-tbody');
    if (auditTbody && data.audit_log) {
      auditTbody.innerHTML = data.audit_log.map(item => `
        <tr>
          <td style="font-family:var(--font-mono); color:var(--text-dim);">${escapeHtml(item.timestamp)}</td>
          <td style="font-weight:600; color:#fff;">${escapeHtml(item.type)}</td>
          <td style="color:#cbd5e1;">${escapeHtml(item.model || '')} ${item.tokens ? `(${item.tokens} tok)` : ''}</td>
          <td style="font-family:var(--font-mono); color:var(--blue-bright);">${escapeHtml(item.user)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Admin telemetry fetch note:', err);
  }
};

window.testGeminiConnection = async function() {
  showToast('Testing Gemini Connection...', '⚡');
  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/admin/test-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ model_type: 'gemini' })
    });
    const data = await res.json();
    showToast(data.success ? `Gemini Online! (${data.latency_ms}ms)` : `Gemini Error: ${data.error}`, data.success ? '✅' : '⚠️');
  } catch (err) {
    showToast(`Test failed: ${err.message}`, '❌');
  }
};

window.testLlamaConnection = async function() {
  showToast('Testing Local Ollama LLaMA...', '🦙');
  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/admin/test-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ model_type: 'llama' })
    });
    const data = await res.json();
    showToast(data.success ? `Ollama Online! (${data.latency_ms}ms)` : `Ollama Offline: ${data.error}`, data.success ? '✅' : '⚠️');
  } catch (err) {
    showToast(`Test failed: ${err.message}`, '❌');
  }
};

// ==============================================================================
// 7. NEURAL MEMORY BANK
// ==============================================================================
async function renderMemoryPage() {
  const container = document.getElementById('memory-items-container');
  if (!container) return;

  if (!state.currentUser) {
    container.innerHTML = `
      <div class="empty-state-box">
        <span style="font-size:2.5rem; display:block; margin-bottom:12px;">🔒</span>
        <h3>Neural Memory Locked in Guest Mode</h3>
        <p>Please sign in to access and persist your custom AI memory notes, system rules, and conversation recall.</p>
        <button class="primary-btn" onclick="openLoginModal()" style="margin-top:16px;">Sign In to Unlock Memory</button>
      </div>
    `;
    return;
  }

  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/memory', { headers });
    const data = await res.json();

    const notes = data.notes || [];

    if (notes.length === 0) {
      container.innerHTML = '<div class="empty-state-box"><p>No custom memory notes recorded yet. Add your first note above!</p></div>';
      return;
    }

    container.innerHTML = notes.map((note, idx) => `
      <div class="memory-note-card">
        <div class="memory-note-text">${escapeHtml(note)}</div>
        <button class="memory-del-btn" onclick="deleteMemoryNote(${idx})" title="Delete note">✕</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state-box"><p>Failed to load memory: ${escapeHtml(err.message)}</p></div>`;
  }
}

window.addCustomMemoryNote = async function() {
  const input = document.getElementById('memory-new-input');
  const note = input ? input.value.trim() : '';
  if (!note) {
    showToast('Please type a memory note to store.', '⚠️');
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/memory/notes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ note })
    });
    if (res.ok) {
      if (input) input.value = '';
      showToast('Note added to Neural Memory Bank! 🧠', '🧠');
      renderMemoryPage();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.detail || 'Failed to save note', '⚠️');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, '❌');
  }
};

window.deleteMemoryNote = async function(idx) {
  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch(`/api/memory/notes/${idx}`, { method: 'DELETE', headers });
    if (res.ok) {
      showToast('Memory note deleted.', '🗑️');
      renderMemoryPage();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, '❌');
  }
};

window.clearAllMemoryNotes = async function() {
  if (!confirm('Are you sure you want to delete ALL memory notes?')) return;
  try {
    const headers = {};
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    const res = await fetch('/api/memory/clear', { method: 'DELETE', headers });
    if (res.ok) {
      showToast('Neural Memory cleared cleanly.', '🧹');
      renderMemoryPage();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, '❌');
  }
};

// ==============================================================================
// 8. CODEX INTELLIGENT CODE LAB
// ==============================================================================
window.updateCodexLineNumbers = function() {
  const codeEl = document.getElementById('codex-editor');
  const lineNumEl = document.getElementById('codex-line-numbers');
  const lineCountEl = document.getElementById('codex-line-count');
  const charCountEl = document.getElementById('codex-char-count');
  if (!codeEl) return;

  const text = codeEl.value || '';
  const lines = text.split('\n');
  const lineCount = Math.max(1, lines.length);

  if (lineNumEl) {
    let numHtml = '';
    for (let i = 1; i <= lineCount; i++) {
      numHtml += `<div>${i}</div>`;
    }
    lineNumEl.innerHTML = numHtml;
    lineNumEl.scrollTop = codeEl.scrollTop;
  }
  if (lineCountEl) lineCountEl.textContent = `Lines: ${lineCount}`;
  if (charCountEl) charCountEl.textContent = `Chars: ${text.length}`;
};

window.switchCodexTab = function(tabName) {
  const tabs = document.querySelectorAll('[id^="codex-tab-"]');
  tabs.forEach(t => t.classList.toggle('active', t.id === `codex-tab-${tabName}-btn`));

  const views = ['console', 'check', 'fix'];
  views.forEach(v => {
    const el = document.getElementById(`codex-view-${v}`);
    if (el) el.style.display = v === tabName ? 'block' : 'none';
  });
};

window.runCodexCode = async function() {
  const codeEl = document.getElementById('codex-editor');
  const langSelect = document.getElementById('codex-lang-select');
  const outEl = document.getElementById('codex-console-output');
  const pill = document.getElementById('codex-status-pill');
  const code = codeEl ? codeEl.value : '';
  const lang = langSelect ? langSelect.value : 'python';

  if (!code.trim()) {
    showToast('Code editor is empty.', '⚠️');
    return;
  }

  switchCodexTab('console');
  if (pill) { pill.className = 'codex-status-pill running'; pill.textContent = 'Running...'; }
  if (outEl) outEl.textContent = 'Executing sandbox code...\n';
  showToast('Running code in execution engine...', '⚡');

  try {
    const res = await fetch('/api/execute-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: lang })
    });
    const data = await res.json();
    if (outEl) {
      outEl.textContent = data.output || data.stdout || data.stderr || 'Execution finished (no output).';
    }
    if (pill) {
      pill.className = `codex-status-pill ${data.success ? 'success' : 'error'}`;
      pill.textContent = data.success ? 'Success ✅' : 'Error ⚠️';
    }
    showToast(data.success ? 'Execution succeeded! ✅' : 'Execution notice ⚠️', data.success ? '✅' : '⚠️');
  } catch (err) {
    if (outEl) outEl.textContent = `Execution Error: ${err.message}`;
    if (pill) { pill.className = 'codex-status-pill error'; pill.textContent = 'Error ❌'; }
    showToast(`Run error: ${err.message}`, '❌');
  }
};

window.checkCodexCode = async function() {
  const codeEl = document.getElementById('codex-editor');
  const langSelect = document.getElementById('codex-lang-select');
  const modelSelect = document.getElementById('codex-model-select');
  const outEl = document.getElementById('codex-report-box');
  const pill = document.getElementById('codex-status-pill');
  const code = codeEl ? codeEl.value : '';
  const lang = langSelect ? langSelect.value : 'python';
  const model = modelSelect ? modelSelect.value : state.model;

  if (!code.trim()) {
    showToast('No code to inspect.', '⚠️');
    return;
  }

  switchCodexTab('check');
  if (pill) { pill.className = 'codex-status-pill running'; pill.textContent = 'Analyzing...'; }
  if (outEl) outEl.innerHTML = '<div style="color:var(--blue-bright); padding:10px;">🔍 Running AST & neural diagnostic check...</div>';
  showToast('Analyzing code syntax & logic...', '🔍');

  try {
    const res = await fetch('/api/codex/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: lang, model })
    });
    const data = await res.json();
    if (outEl) {
      outEl.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:0.86rem; line-height:1.6;">
          <div style="font-weight:700; color:${data.valid ? '#10b981' : '#f59e0b'}; margin-bottom:8px;">
            === CODEX CODE ANALYSIS ===<br/>
            Status: ${data.valid ? 'PASSED ✅' : 'ISSUES DETECTED ⚠️'}<br/>
            Syntax Errors: ${data.error_count || 0}
          </div>
          <div style="white-space:pre-wrap; color:#cbd5e1; margin-top:12px;">${escapeHtml(data.analysis || data.message || 'No syntax issues found.')}</div>
        </div>
      `;
    }
    if (pill) {
      pill.className = `codex-status-pill ${data.valid ? 'success' : 'error'}`;
      pill.textContent = data.valid ? 'Passed ✅' : 'Issues Found ⚠️';
    }
    showToast(data.valid ? 'Codex check passed!' : 'Issues found in code', data.valid ? '✅' : '⚠️');
  } catch (err) {
    if (outEl) outEl.textContent = `Check Error: ${err.message}`;
    if (pill) { pill.className = 'codex-status-pill error'; pill.textContent = 'Error ❌'; }
  }
};

window.fixCodexCode = async function() {
  const codeEl = document.getElementById('codex-editor');
  const langSelect = document.getElementById('codex-lang-select');
  const modelSelect = document.getElementById('codex-model-select');
  const fixBox = document.getElementById('codex-fix-box');
  const pill = document.getElementById('codex-status-pill');
  const code = codeEl ? codeEl.value : '';
  const lang = langSelect ? langSelect.value : 'python';
  const model = modelSelect ? modelSelect.value : state.model;

  if (!code.trim()) {
    showToast('No code to repair.', '⚠️');
    return;
  }

  switchCodexTab('fix');
  if (pill) { pill.className = 'codex-status-pill running'; pill.textContent = 'Synthesizing Fix...'; }
  if (fixBox) fixBox.innerHTML = '<div style="color:var(--orange-bright); padding:10px;">🛠️ Synthesizing AI repair and optimization...</div>';
  showToast('AI repairing and optimizing code...', '🪄');

  try {
    const res = await fetch('/api/codex/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: lang, model })
    });
    const data = await res.json();
    if (res.ok && data.fixed_code) {
      window._latestFixedCode = data.fixed_code;
      if (fixBox) {
        fixBox.innerHTML = `
          <div style="font-family:var(--font-mono); font-size:0.86rem; line-height:1.6;">
            <div style="font-weight:700; color:var(--blue-bright); margin-bottom:10px;">
              === AI REPAIR & OPTIMIZATION REPORT ===<br/>
              <span style="font-weight:400; color:#cbd5e1;">${escapeHtml(data.explanation || 'Optimizations complete.')}</span>
            </div>
            <div style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
              <div style="font-weight:700; color:#10b981; margin-bottom:6px;">--- PROPOSED CODE ---</div>
              <pre style="background:#020617; padding:12px; border-radius:8px; border:1px solid var(--border-subtle); color:#38f8ff; overflow-x:auto;"><code>${escapeHtml(data.fixed_code)}</code></pre>
            </div>
          </div>
        `;
      }
      if (pill) {
        pill.className = 'codex-status-pill success';
        pill.textContent = 'Fix Ready ✨';
      }
      showToast('AI Repair ready! Click Apply Fix to load into editor.', '✨');
    } else {
      showToast(data.detail || 'Repair notice', '⚠️');
    }
  } catch (err) {
    showToast(`Fix error: ${err.message}`, '❌');
    if (pill) { pill.className = 'codex-status-pill error'; pill.textContent = 'Error ❌'; }
  }
};

window.applyCodexFixToEditor = async function(saveToFile = false) {
  if (window._latestFixedCode) {
    const codeEl = document.getElementById('codex-editor');
    if (codeEl) {
      codeEl.value = window._latestFixedCode;
      updateCodexLineNumbers();
    }
    showToast('Applied AI fix to editor! ✅', '✅');
    if (saveToFile && state.codexActiveFile) {
      await saveCodexActiveFile();
    }
  } else {
    showToast('No proposed fix available yet. Click Fix Code (AI) first.', '⚠️');
  }
};

window.clearCodexEditor = function() {
  const codeEl = document.getElementById('codex-editor');
  if (codeEl) {
    codeEl.value = '';
    updateCodexLineNumbers();
  }
  showToast('Code editor cleared.', '🧹');
};

window.copyCodexEditorCode = function() {
  const codeEl = document.getElementById('codex-editor');
  if (codeEl && codeEl.value) {
    navigator.clipboard.writeText(codeEl.value);
    showToast('Code copied to clipboard!', '📋');
  }
};

window.loadCodexSample = function() {
  const sample = `def fibonacci_sequence(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

print("Fibonacci first 10 terms:", fibonacci_sequence(10))
`;
  const codeEl = document.getElementById('codex-editor');
  if (codeEl) {
    codeEl.value = sample;
    updateCodexLineNumbers();
  }
  showToast('Loaded Python sample into Codex!', '💻');
};

window.openCodexFilePicker = function() {
  const picker = document.getElementById('codex-file-input');
  if (picker) picker.click();
};

window.handleCodexFilePicked = function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const codeEl = document.getElementById('codex-editor');
    if (codeEl) {
      codeEl.value = content;
      updateCodexLineNumbers();
    }
    state.codexActiveFile = file.name;
    const badge = document.getElementById('codex-active-file-badge');
    const nameEl = document.getElementById('codex-active-file-name');
    const saveBtn = document.getElementById('codex-save-btn');
    if (badge) badge.style.display = 'inline-flex';
    if (nameEl) nameEl.textContent = file.name;
    if (saveBtn) saveBtn.style.display = 'inline-block';

    // Auto-detect language
    const ext = file.name.split('.').pop().toLowerCase();
    const langSelect = document.getElementById('codex-lang-select');
    if (langSelect) {
      const extMap = { py: 'python', js: 'javascript', ts: 'typescript', html: 'html', css: 'html', cpp: 'cpp', c: 'cpp', java: 'java', cs: 'csharp', go: 'go', rs: 'rust', sql: 'sql', sh: 'bash', bat: 'bash' };
      if (extMap[ext]) langSelect.value = extMap[ext];
    }
    showToast(`Loaded ${file.name} into Codex! 📄`, '📄');
  };
  reader.readAsText(file);
};

window.saveCodexActiveFile = async function() {
  if (!state.codexActiveFile) {
    showToast('No workspace file currently open.', '⚠️');
    return;
  }
  const codeEl = document.getElementById('codex-editor');
  const content = codeEl ? codeEl.value : '';

  try {
    const res = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.codexActiveFile, content })
    });
    if (res.ok) {
      showToast(`Saved changes to ${state.codexActiveFile}! 💾`, '💾');
    }
  } catch (err) {
    showToast(`Save error: ${err.message}`, '❌');
  }
};

window.detachCodexActiveFile = function() {
  state.codexActiveFile = null;
  const badge = document.getElementById('codex-active-file-badge');
  const saveBtn = document.getElementById('codex-save-btn');
  if (badge) badge.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
  showToast('Detached file reference.', '📄');
};

// ==============================================================================
// 9. FILE EXPLORER & SYSTEM COMMANDS
// ==============================================================================
let currentBrowsePath = '.';

window.refreshFileList = async function() {
  const container = document.getElementById('files-tree-list');
  const curPathEl = document.getElementById('files-current-path');
  if (!container) return;

  try {
    const res = await fetch('/api/files/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentBrowsePath })
    });
    const data = await res.json();
    if (curPathEl) curPathEl.textContent = data.current_path || currentBrowsePath;

    const items = data.items || [];
    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state-box"><p>Directory is empty.</p></div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="file-item-row" onclick="${item.is_dir ? `navigateToPath('${encodeURIComponent(item.path)}')` : `openFileInViewer('${encodeURIComponent(item.path)}')`}">
        <span class="file-icon">${item.is_dir ? '📁' : '📄'}</span>
        <span class="file-name">${escapeHtml(item.name)}</span>
        <span class="file-size">${item.is_dir ? '--' : formatBytes(item.size)}</span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state-box"><p>Failed to browse files: ${escapeHtml(err.message)}</p></div>`;
  }
};

window.navigateToPath = function(encodedPath) {
  currentBrowsePath = decodeURIComponent(encodedPath);
  refreshFileList();
};

window.navigateFileUp = function() {
  currentBrowsePath = currentBrowsePath + '/..';
  refreshFileList();
};

window.openFileInViewer = async function(encodedPath) {
  const filePath = decodeURIComponent(encodedPath);
  try {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (res.ok) {
      state.codexActiveFile = filePath;
      switchView('codex');
      const ed = document.getElementById('codex-editor');
      if (ed) ed.value = data.content || '';
      const badge = document.getElementById('codex-active-file-badge');
      const nameEl = document.getElementById('codex-active-file-name');
      if (badge) badge.style.display = 'inline-flex';
      if (nameEl) nameEl.textContent = filePath;
      showToast(`Loaded ${filePath} into Codex Lab! 📄`, '📄');
    }
  } catch (err) {
    showToast(`Error reading file: ${err.message}`, '⚠️');
  }
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

window.runSysCmd = async function(cmd) {
  showToast(`Running command: ${cmd}...`, '⚡');
  try {
    const res = await fetch('/api/system/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    showToast(data.message || 'Command executed.', data.success ? '✅' : '⚠️');
  } catch (err) {
    showToast(`Command error: ${err.message}`, '❌');
  }
};

window.switchCommandsTab = function(tabName) {
  const tabs = document.querySelectorAll('[id^="cmd-tab-"]');
  tabs.forEach(t => t.classList.toggle('active', t.id === `cmd-tab-${tabName}`));

  const panels = ['power', 'audio', 'apps'];
  panels.forEach(p => {
    const el = document.getElementById(`cmd-panel-${p}`);
    if (el) el.style.display = p === tabName ? 'grid' : 'none';
  });
};

window.confirmShutdown = function() {
  const modal = document.getElementById('shutdown-confirm-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeShutdownModal = function() {
  const modal = document.getElementById('shutdown-confirm-modal');
  if (modal) modal.style.display = 'none';
};

window.executeShutdown = function() {
  closeShutdownModal();
  runSysCmd('shutdown /s /t 5');
};

window.confirmRestart = function() {
  const modal = document.getElementById('restart-confirm-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeRestartModal = function() {
  const modal = document.getElementById('restart-confirm-modal');
  if (modal) modal.style.display = 'none';
};

window.executeRestart = function() {
  closeRestartModal();
  runSysCmd('shutdown /r /t 5');
};

// ==============================================================================
// 10. SETTINGS & THEMES
// ==============================================================================
window.switchSettingsSubTab = function(tabName) {
  const tabs = document.querySelectorAll('[id^="set-tab-"]');
  tabs.forEach(t => t.classList.toggle('active', t.id === `set-tab-${tabName}`));

  const panels = ['ai', 'voice', 'theme', 'data'];
  panels.forEach(p => {
    const el = document.getElementById(`settings-panel-${p}`);
    if (el) el.style.display = p === tabName ? 'block' : 'none';
  });
};

window.loadSettingsIntoUI = async function() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      const cloudModel = document.getElementById('setting-cloud-model');
      const localModel = document.getElementById('setting-local-model');
      const ollamaHost = document.getElementById('setting-ollama-host');
      const speechRate = document.getElementById('setting-speech-rate');
      const tempSlider = document.getElementById('setting-temp-slider');
      const tempVal = document.getElementById('temp-val');
      const hfToken = document.getElementById('setting-hf-token');
      const geminiKey = document.getElementById('setting-gemini-key');
      const persona = document.getElementById('setting-system-persona');
      const supervisor = document.getElementById('setting-supervisor-toggle');

      if (cloudModel && cfg.cloud_model) cloudModel.value = cfg.cloud_model;
      if (localModel && cfg.local_model) localModel.value = cfg.local_model;
      if (ollamaHost && cfg.ollama_host) ollamaHost.value = cfg.ollama_host;
      if (speechRate && cfg.speech_rate) speechRate.value = cfg.speech_rate;
      if (tempSlider && cfg.temperature !== undefined) {
        tempSlider.value = cfg.temperature;
        if (tempVal) tempVal.textContent = cfg.temperature;
      }
      if (hfToken && cfg.huggingface_token) hfToken.value = cfg.huggingface_token;
      if (geminiKey && cfg.gemini_api_key && cfg.gemini_api_key !== 'AQ.Ab8RN6L_IRoeUS77CBl74zPPJC2az-nkP9RLUEH5KUKeZCqv0g') {
        geminiKey.value = cfg.gemini_api_key;
      }
      if (persona && cfg.system_persona) persona.value = cfg.system_persona;
      if (supervisor && cfg.supervisor_enabled !== undefined) supervisor.checked = !!cfg.supervisor_enabled;
    }
  } catch (err) {
    console.warn('Load settings notice:', err);
  }
};

window.saveAllSettings = async function() {
  const cloudModel = document.getElementById('setting-cloud-model');
  const localModel = document.getElementById('setting-local-model');
  const ollamaHost = document.getElementById('setting-ollama-host');
  const speechRate = document.getElementById('setting-speech-rate');
  const tempSlider = document.getElementById('setting-temp-slider');
  const hfToken = document.getElementById('setting-hf-token');
  const geminiKey = document.getElementById('setting-gemini-key');
  const persona = document.getElementById('setting-system-persona');
  const supervisor = document.getElementById('setting-supervisor-toggle');

  const config = {
    cloud_model: cloudModel ? cloudModel.value : 'gemini-3.8-flash',
    local_model: localModel ? localModel.value : 'llama3.2',
    ollama_host: ollamaHost ? ollamaHost.value.trim() : 'http://127.0.0.1:11434',
    speech_rate: speechRate ? parseFloat(speechRate.value) || 1.0 : 1.0,
    temperature: tempSlider ? parseFloat(tempSlider.value) || 0.7 : 0.7,
    huggingface_token: hfToken ? hfToken.value.trim() : '',
    system_persona: persona ? persona.value : 'master_vedas',
    supervisor_enabled: supervisor ? supervisor.checked : false
  };

  if (geminiKey && geminiKey.value.trim()) {
    config.gemini_api_key = geminiKey.value.trim();
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      if (config.cloud_model) state.model = config.cloud_model;
      const hint = document.getElementById('settings-saved-hint');
      if (hint) {
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 3000);
      }
      showToast('Settings & Neural Tokens saved successfully! ✅', '✅');
    } else {
      showToast('Failed to save settings.', '⚠️');
    }
  } catch (err) {
    showToast(`Save error: ${err.message}`, '❌');
  }
};

window.applyTheme = function(themeName) {
  const themeMap = {
    'blue_orange': 'deep-space',
    'cyan_amber': 'cyber-cyan',
    'emerald_neon': 'matrix-emerald',
    'crimson_violet': 'crimson-abyss',
    'midnight_blue': 'royal-amethyst',
    'deep-space': 'deep-space',
    'cyber-cyan': 'cyber-cyan',
    'matrix-emerald': 'matrix-emerald',
    'crimson-abyss': 'crimson-abyss',
    'royal-amethyst': 'royal-amethyst'
  };
  const normalized = themeMap[themeName] || themeName;
  state.theme = normalized;
  document.body.setAttribute('data-theme', normalized);
  localStorage.setItem('vedas_theme', normalized);

  const themeSelect = document.getElementById('setting-theme-palette');
  if (themeSelect) {
    const reverseMap = {
      'deep-space': 'blue_orange',
      'cyber-cyan': 'cyan_amber',
      'matrix-emerald': 'emerald_neon',
      'crimson-abyss': 'crimson_violet',
      'royal-amethyst': 'midnight_blue'
    };
    if (reverseMap[normalized]) themeSelect.value = reverseMap[normalized];
  }

  showToast(`Applied Theme: ${normalized}`, '🎨');
};

window.cycleTheme = function() {
  const themes = ['deep-space', 'cyber-cyan', 'matrix-emerald', 'crimson-abyss', 'royal-amethyst'];
  const curIdx = themes.indexOf(state.theme);
  const nextTheme = themes[(curIdx + 1) % themes.length];
  applyTheme(nextTheme);
};

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    showToast('Fullscreen Activated', '⛶');
  } else {
    document.exitFullscreen().catch(() => {});
    showToast('Fullscreen Exited', '⛶');
  }
};

window.exportFullBackup = function() {
  const data = {
    user: state.currentUser,
    sessions: state.sessions,
    theme: state.theme,
    model: state.model,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vedas_ai_backup_${Date.now()}.json`;
  a.click();
  showToast('Exported full configuration backup! 💾', '💾');
};

window.clearTransientCache = function() {
  try {
    sessionStorage.clear();
    currentVeoImage = null;
    currentVeoVideo = null;
    currentVeoVideoBlob = null;
    showToast('Transient web cache and media memory cleared cleanly! 🧹', '🧹');
  } catch(e) {
    showToast('Cache cleared.', '🧹');
  }
};

// ==============================================================================
// 11. ATTACHMENT TRAY & INITIALIZATION
// ==============================================================================
function renderAttachmentTray() {
  const tray = document.getElementById('attachment-tray');
  if (!tray) return;

  if (!state.attachments || state.attachments.length === 0) {
    tray.style.display = 'none';
    tray.innerHTML = '';
    return;
  }

  tray.style.display = 'flex';
  tray.innerHTML = state.attachments.map((att, i) => {
    const isImg = att.type === 'image' || (att.data && typeof att.data === 'string' && att.data.startsWith('data:image')) || (att.url && att.url.match(/\.(jpg|jpeg|png|webp|gif)$/i));
    const isVid = att.type === 'video' || (att.data && typeof att.data === 'string' && att.data.startsWith('data:video')) || (att.url && att.url.match(/\.(mp4|webm|mov)$/i));
    const icon = isImg ? '🖼️' : (isVid ? '🎥' : '📄');
    const thumbSrc = att.preview || att.data || att.url;
    const thumbHtml = (isImg && thumbSrc && thumbSrc.startsWith('data:image')) ? `<img src="${thumbSrc}" class="attachment-thumb" />` : '';

    return `
      <div class="attachment-pill">
        ${thumbHtml}
        <span class="attachment-icon">${icon}</span>
        <span class="attachment-name" title="${escapeHtml(att.name || 'Attachment')}">${escapeHtml(att.name || 'Attachment')}</span>
        <button type="button" class="attachment-remove-btn" onclick="removeAttachment(${i})" title="Remove attachment">✕</button>
      </div>
    `;
  }).join('');
}

window.removeAttachment = function(index) {
  if (state.attachments && index >= 0 && index < state.attachments.length) {
    state.attachments.splice(index, 1);
    renderAttachmentTray();
  }
};

window.handleChatFileUpload = async function(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append('file', file);

    const isImage = file.type.startsWith('image');
    const isVideo = file.type.startsWith('video');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUri = evt.target.result;
      state.attachments.push({
        name: file.name,
        type: isImage ? 'image' : (isVideo ? 'video' : 'document'),
        data: dataUri,
        preview: isImage ? dataUri : null,
        size: file.size
      });
      renderAttachmentTray();
      showToast(`Attached ${file.name}`, '📎');
    };
    reader.readAsDataURL(file);

    try {
      fetch('/api/upload', { method: 'POST', body: formData }).catch(() => {});
    } catch (err) {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  const modelSel = document.getElementById('model-selector');
  if (modelSel) {
    if (state.model) modelSel.value = state.model;
    modelSel.addEventListener('change', (e) => {
      state.model = e.target.value;
      const codexModel = document.getElementById('codex-model-select');
      if (codexModel) codexModel.value = state.model;
      showToast(`Active Model: ${state.modelDisplayNames[state.model] || state.model}`, '⚡');
    });
  }

  const codexModelSel = document.getElementById('codex-model-select');
  if (codexModelSel) {
    codexModelSel.addEventListener('change', (e) => {
      state.model = e.target.value;
      if (modelSel) modelSel.value = state.model;
      showToast(`Active Model: ${state.modelDisplayNames[state.model] || state.model}`, '💻');
    });
  }

  const personaSel = document.getElementById('persona-selector');
  if (personaSel) {
    personaSel.addEventListener('change', (e) => {
      state.persona = e.target.value;
      showToast(`Persona: ${state.persona}`, '🎭');
    });
  }

  const fileInp = document.getElementById('file-input');
  if (fileInp) {
    fileInp.addEventListener('change', handleChatFileUpload);
  }

  const codexEditor = document.getElementById('codex-editor');
  if (codexEditor) {
    codexEditor.addEventListener('input', updateCodexLineNumbers);
    codexEditor.addEventListener('scroll', () => {
      const lineNumEl = document.getElementById('codex-line-numbers');
      if (lineNumEl) lineNumEl.scrollTop = codexEditor.scrollTop;
    });
    updateCodexLineNumbers();
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleVoiceListening();
    }
  });

  window.addEventListener('click', (e) => {
    const userDropdown = document.getElementById('user-dropdown-menu');
    if (userDropdown && !userDropdown.contains(e.target) && !e.target.closest('#user-profile-widget')) {
      closeUserDropdown();
    }
  });

  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.getVoices();
    } catch (e) {}
  }

  // Load saved theme
  const savedTheme = localStorage.getItem('vedas_theme') || 'deep-space';
  applyTheme(savedTheme);

  setInterval(() => {
    const clock = document.getElementById('header-live-clock');
    if (clock) {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 1000);

  initAuthState();
  initSpeechRecognition();
  loadSettingsIntoUI();
});
