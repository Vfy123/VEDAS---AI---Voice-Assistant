/**
 * VEDAS LIVE — Real-Time Voice-to-Voice Duplex Engine & Multimodal Vision Core
 * Provides ultra-low-latency bidirectional conversational voice interaction,
 * living neural plasma orb visualization, full Push-to-Talk vs Continuous Duplex,
 * instant tap-to-interrupt mechanics, and integrated webcam & native display Screen Vision.
 */

(function() {
  'use strict';

  // Live Duplex Global State
  window.liveState = {
    active: false,
    mode: 'continuous', // 'continuous' | 'push_to_talk'
    status: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
    isMicActive: false,
    isSpeaking: false,
    speakerMuted: false,
    cameraActive: false,
    screenActive: false,
    persona: 'master_vedas',
    mediaStream: null,       // Webcam stream
    screenStream: null,      // Desktop getDisplayMedia stream
    audioCtx: null,
    analyser: null,
    micSource: null,
    audioDataArray: null,
    recognition: null,
    speechSilenceTimer: null,
    accumulatedText: '',
    animFrameId: null,
    lastUserSpoken: '',
    latencyStart: 0,
    isPttHolding: false,
    pttStartTime: 0
  };

  const LIVE_PERSONAS = {
    master_vedas: { name: 'Master Vedas', rate: 1.05, pitch: 1.0, prompt: 'You are VEDAS Live in voice duplex mode. Speak concisely, directly, and naturally in 1-3 direct conversational sentences without emojis, markdown formatting, or robotic meta commentary.' },
    cyber_coder: { name: 'Cyber Coder', rate: 1.1, pitch: 0.95, prompt: 'You are VEDAS Live (Cyber Coder). Answer technical engineering queries conversationally, directly, and sharply in 1-3 spoken sentences.' },
    deep_thinker: { name: 'Deep Thinker', rate: 0.95, pitch: 0.9, prompt: 'You are VEDAS Live (Deep Thinker). Provide deep, analytical, and articulate spoken insights concisely in 1-3 sentences.' },
    creative_muse: { name: 'Creative Muse', rate: 1.05, pitch: 1.1, prompt: 'You are VEDAS Live (Creative Muse). Speak with vivid, imaginative, and expressive conversational tone.' },
    sarcastic_genius: { name: 'Sarcastic Genius', rate: 1.12, pitch: 1.05, prompt: 'You are VEDAS Live (Sarcastic Genius). Speak with charming wit, sharp intellect, and concise banter.' }
  };

  // --------------------------------------------------------------------------
  // 1. NEURAL PLASMA ORB VISUALIZER
  // --------------------------------------------------------------------------
  class LiveOrbVisualizer {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.width = 420;
      this.height = 420;
      this.particles = [];
      this.plasmaPhase = 0;
      this.pulseIntensity = 0;
      this.baseHue = 195; // Blue/Cyan
      this.secondaryHue = 25; // Orange
      this.initParticles();
      this.resize();
    }

    resize() {
      if (!this.canvas) return;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      if (this.ctx) this.ctx.scale(dpr, dpr);
    }

    initParticles() {
      this.particles = [];
      const count = 48;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 90 + Math.random() * 50;
        this.particles.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          baseAngle: angle,
          baseDist: dist,
          speed: 0.01 + Math.random() * 0.02,
          size: 2 + Math.random() * 3.5,
          alpha: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.width / 2;
      const cy = this.height / 2;

      // Extract real audio frequency volume
      let audioVolume = 0;
      if (liveState.analyser && liveState.audioDataArray && (liveState.status === 'listening' || liveState.status === 'speaking')) {
        liveState.analyser.getByteFrequencyData(liveState.audioDataArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += liveState.audioDataArray[i];
        }
        audioVolume = (sum / 32) / 255.0; // [0.0 - 1.0]
      }

      this.plasmaPhase += 0.035;
      const state = liveState.status;

      // Smooth pulse dynamics
      let targetPulse = 0;
      if (state === 'listening') {
        targetPulse = 0.2 + audioVolume * 0.8;
      } else if (state === 'speaking') {
        targetPulse = 0.3 + Math.sin(this.plasmaPhase * 4) * 0.3 + audioVolume * 0.4;
      } else if (state === 'thinking') {
        targetPulse = 0.25 + Math.sin(this.plasmaPhase * 8) * 0.2;
      } else {
        targetPulse = 0.08 + Math.sin(this.plasmaPhase * 1.5) * 0.05;
      }
      this.pulseIntensity += (targetPulse - this.pulseIntensity) * 0.2;

      // State Colors
      let coreColor1 = 'rgba(0, 210, 255, 0.45)';
      let coreColor2 = 'rgba(255, 110, 0, 0.3)';
      let ringColor = 'rgba(0, 210, 255, 0.6)';

      if (state === 'listening') {
        coreColor1 = 'rgba(16, 185, 129, 0.55)';
        coreColor2 = 'rgba(0, 210, 255, 0.4)';
        ringColor = 'rgba(16, 185, 129, 0.8)';
      } else if (state === 'thinking') {
        coreColor1 = 'rgba(245, 158, 11, 0.55)';
        coreColor2 = 'rgba(239, 68, 68, 0.45)';
        ringColor = 'rgba(245, 158, 11, 0.85)';
      } else if (state === 'speaking') {
        coreColor1 = 'rgba(255, 94, 0, 0.65)';
        coreColor2 = 'rgba(0, 210, 255, 0.45)';
        ringColor = 'rgba(255, 94, 0, 0.85)';
      }

      // Outer Plasma Glow Flare
      const outerRadius = 140 + this.pulseIntensity * 45;
      const gradOuter = ctx.createRadialGradient(cx, cy, 30, cx, cy, outerRadius);
      gradOuter.addColorStop(0, coreColor1);
      gradOuter.addColorStop(0.6, coreColor2);
      gradOuter.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradOuter;
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Deformable Kinetic Wave Perimeter
      const numPoints = 64;
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const wave = Math.sin(theta * 6 + this.plasmaPhase * 3) * (6 + this.pulseIntensity * 18);
        const wave2 = Math.cos(theta * 4 - this.plasmaPhase * 2) * (4 + this.pulseIntensity * 12);
        const r = 95 + wave + wave2 + this.pulseIntensity * 25;
        const px = cx + Math.cos(theta) * r;
        const py = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5 + this.pulseIntensity * 3;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 18 + this.pulseIntensity * 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Swirling Quantum Particles
      for (let p of this.particles) {
        p.phase += p.speed * (state === 'thinking' ? 4 : 1.5);
        const angle = p.baseAngle + p.phase;
        const dist = p.baseDist + Math.sin(p.phase * 2) * (15 + this.pulseIntensity * 30);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;

        ctx.fillStyle = state === 'speaking' ? `rgba(255, 140, 0, ${p.alpha})` : (state === 'listening' ? `rgba(16, 185, 129, ${p.alpha})` : `rgba(0, 210, 255, ${p.alpha})`);
        ctx.beginPath();
        ctx.arc(px, py, p.size * (1 + this.pulseIntensity * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      // Inner Core Glow
      const gradInner = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      gradInner.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      gradInner.addColorStop(0.5, coreColor1);
      gradInner.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradInner;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let visualizerInstance = null;

  function runVisualizerLoop() {
    if (visualizerInstance && liveState.active) {
      visualizerInstance.render();
      liveState.animFrameId = requestAnimationFrame(runVisualizerLoop);
    }
  }

  // --------------------------------------------------------------------------
  // 2. LIVE SPEECH & AUDIO STREAMING CORE
  // --------------------------------------------------------------------------
  function initLiveAudioAnalyzer() {
    try {
      if (!liveState.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        liveState.audioCtx = new AudioContext();
        liveState.analyser = liveState.audioCtx.createAnalyser();
        liveState.analyser.fftSize = 64;
        liveState.audioDataArray = new Uint8Array(liveState.analyser.frequencyBinCount);
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !liveState.micSource) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          if (liveState.audioCtx) {
            liveState.micSource = liveState.audioCtx.createMediaStreamSource(stream);
            liveState.micSource.connect(liveState.analyser);
          }
        }).catch(err => {
          console.log('Live mic stream notice (non-fatal):', err);
        });
      }
    } catch (e) {
      console.warn('Live audio analyzer notice:', e);
    }
  }

  function initLiveSpeechEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not available in this browser.');
      return;
    }

    try {
      if (liveState.recognition) {
        try { liveState.recognition.abort(); } catch(e){}
      }

      liveState.recognition = new SpeechRecognition();
      liveState.recognition.continuous = true;
      liveState.recognition.interimResults = true;
      liveState.recognition.lang = 'en-US';

      liveState.recognition.onstart = () => {
        liveState.isMicActive = true;
        updateLiveUiState('listening');
      };

      liveState.recognition.onresult = (event) => {
        if (liveState.status === 'thinking') return;

        // Instant interruption: If VEDAS is speaking and user speaks, cancel speech synthesis immediately!
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          liveState.isSpeaking = false;
        }

        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += trans;
          else interim += trans;
        }

        const currentSpoken = (final || interim || '').trim();
        if (currentSpoken) {
          liveState.accumulatedText = currentSpoken;
          updateLiveSubtitle('YOU', currentSpoken, true);
          updateLiveUiState('listening');

          // Silence detection debounce: ONLY in continuous duplex mode!
          if (liveState.mode === 'continuous') {
            if (liveState.speechSilenceTimer) clearTimeout(liveState.speechSilenceTimer);
            liveState.speechSilenceTimer = setTimeout(() => {
              if (liveState.accumulatedText && liveState.active && liveState.status !== 'thinking') {
                const textToSend = liveState.accumulatedText;
                liveState.accumulatedText = '';
                dispatchLiveTurn(textToSend);
              }
            }, 1400);
          }
        }
      };

      liveState.recognition.onend = () => {
        liveState.isMicActive = false;
        // In continuous mode: auto restart recognition
        if (liveState.mode === 'continuous' && liveState.active && liveState.status !== 'thinking' && liveState.status !== 'speaking') {
          try {
            liveState.recognition.start();
          } catch (e) {}
        } else if (liveState.mode === 'push_to_talk' && !liveState.isPttHolding && liveState.status !== 'thinking' && liveState.status !== 'speaking') {
          updateLiveUiState('idle');
        }
      };

      liveState.recognition.onerror = (e) => {
        console.log('Live recognition notice:', e.error);
        if (e.error === 'not-allowed') {
          showToast('Microphone access denied for VEDAS Live.', '⚠️');
        }
      };
    } catch (err) {
      console.warn('Live speech init error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // 3. MULTIMODAL DUPLEX REASONING & DISPATCH
  // --------------------------------------------------------------------------
  async function dispatchLiveTurn(userPrompt) {
    if (!userPrompt || !liveState.active) return;
    liveState.lastUserSpoken = userPrompt;
    liveState.latencyStart = performance.now();

    updateLiveUiState('thinking');
    updateLiveSubtitle('YOU', userPrompt, false);

    const headline = document.getElementById('live-state-headline');
    if (headline) headline.textContent = 'VEDAS IS REASONING...';

    // Capture vision snapshot if camera or screen vision is enabled
    let attachments = [];
    if (liveState.cameraActive) {
      const snap = captureCameraSnapshot();
      if (snap) attachments.push({ type: 'image', data: snap, name: 'camera_view.jpg' });
    } else if (liveState.screenActive) {
      const snap = captureScreenSnapshot();
      if (snap) {
        attachments.push({ type: 'image', data: snap, name: 'screen_view.jpg' });
      } else {
        try {
          const snapRes = await fetch('/api/screen-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'Capture screenshot' })
          });
          const snapData = await snapRes.json();
          if (snapData.image_data) {
            attachments.push({ type: 'image', data: snapData.image_data, name: 'screen_view.jpg' });
          }
        } catch (e) {
          console.log('Screen capture notice:', e);
        }
      }
    }

    const personaCfg = LIVE_PERSONAS[liveState.persona] || LIVE_PERSONAS.master_vedas;
    const fullSystemPrompt = `${personaCfg.prompt}\nUser spoken voice input: "${userPrompt}"`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullSystemPrompt,
          persona: liveState.persona,
          attachments: attachments
        })
      });

      const data = await res.json();
      const elapsedMs = Math.round(performance.now() - liveState.latencyStart);
      const latEl = document.getElementById('live-latency-val');
      if (latEl) latEl.textContent = `${elapsedMs}ms`;

      if (res.ok && liveState.active) {
        let rawAnswer = data.response || data.reply || data.text || 'I understand.';
        // Clean markdown symbols for natural speech
        const speechText = cleanTextForSpeech(rawAnswer);
        speakLiveResponse(speechText);
      } else {
        updateLiveSubtitle('VEDAS', data.detail || 'I encountered an issue processing that.', false);
        updateLiveUiState('idle');
      }
    } catch (err) {
      console.warn('Live dispatch error:', err);
      updateLiveSubtitle('VEDAS', `Connection error: ${err.message}`, false);
      updateLiveUiState('idle');
    }
  }

  function cleanTextForSpeech(text) {
    return text
      .replace(/```[\s\S]*?```/g, ' Code snippet omitted for speech. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~>]/g, '')
      .replace(/\[\d+\]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  }

  function speakLiveResponse(text) {
    if (!liveState.active) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    updateLiveUiState('speaking');
    updateLiveSubtitle('VEDAS', text, false);

    const headline = document.getElementById('live-state-headline');
    if (headline) headline.textContent = 'VEDAS IS SPEAKING';

    const subtext = document.getElementById('live-state-subtext');
    if (subtext) subtext.textContent = 'Tap the orb anytime to interrupt and speak';

    if (liveState.speakerMuted || !window.speechSynthesis) {
      setTimeout(() => {
        if (liveState.active) {
          if (liveState.mode === 'continuous') updateLiveUiState('listening');
          else updateLiveUiState('idle');
        }
      }, 3000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const personaCfg = LIVE_PERSONAS[liveState.persona] || LIVE_PERSONAS.master_vedas;
    utterance.rate = personaCfg.rate || 1.05;
    utterance.pitch = personaCfg.pitch || 1.0;

    // Pick best English neural voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Mark')));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      liveState.isSpeaking = false;
      if (liveState.active) {
        if (liveState.mode === 'continuous') {
          updateLiveUiState('listening');
          const h = document.getElementById('live-state-headline');
          if (h) h.textContent = 'LISTENING TO YOU...';
        } else {
          updateLiveUiState('idle');
          const h = document.getElementById('live-state-headline');
          if (h) h.textContent = 'PUSH TO TALK READY';
        }
      }
    };

    utterance.onerror = () => {
      liveState.isSpeaking = false;
      if (liveState.active) {
        if (liveState.mode === 'continuous') updateLiveUiState('listening');
        else updateLiveUiState('idle');
      }
    };

    liveState.isSpeaking = true;
    window.speechSynthesis.speak(utterance);
  }

  // --------------------------------------------------------------------------
  // 4. UI STATE UPDATER & INTERACTION HANDLERS
  // --------------------------------------------------------------------------
  function updateLiveUiState(status) {
    liveState.status = status;
    const micBtn = document.getElementById('live-mic-btn');
    const micGlyph = document.getElementById('live-mic-glyph');
    const headline = document.getElementById('live-state-headline');
    const subtext = document.getElementById('live-state-subtext');
    const waveContainer = document.getElementById('live-subtitle-audio-wave');

    if (micBtn) {
      micBtn.className = `live-central-mic-btn ${status}`;
    }

    if (status === 'listening') {
      if (micGlyph) micGlyph.textContent = '🎙️';
      if (headline) headline.textContent = liveState.mode === 'push_to_talk' ? 'LISTENING (RELEASE/TAP TO SEND)...' : 'LISTENING TO YOU...';
      if (subtext) subtext.textContent = liveState.mode === 'push_to_talk' ? 'Speak your query • Release or tap to send' : 'Speak naturally • Vedas is actively listening';
      if (waveContainer) waveContainer.style.display = 'flex';
    } else if (status === 'thinking') {
      if (micGlyph) micGlyph.textContent = '⚡';
      if (headline) headline.textContent = 'VEDAS IS REASONING...';
      if (subtext) subtext.textContent = 'Processing neural context & vision streams';
      if (waveContainer) waveContainer.style.display = 'flex';
    } else if (status === 'speaking') {
      if (micGlyph) micGlyph.textContent = '🔊';
      if (headline) headline.textContent = 'VEDAS IS SPEAKING';
      if (subtext) subtext.textContent = 'Tap the orb or mic to interrupt immediately';
      if (waveContainer) waveContainer.style.display = 'flex';
    } else {
      if (micGlyph) micGlyph.textContent = '🎙️';
      if (headline) headline.textContent = liveState.mode === 'push_to_talk' ? 'PUSH TO TALK READY' : 'VEDAS LIVE READY';
      if (subtext) subtext.textContent = liveState.mode === 'push_to_talk' ? 'Hold or tap the mic orb to speak' : 'Speak naturally or tap the orb to talk';
      if (waveContainer) waveContainer.style.display = 'none';
    }
  }

  function updateLiveSubtitle(speaker, text, isInterim = false) {
    const capsule = document.getElementById('live-subtitle-capsule');
    const speakerBadge = document.getElementById('live-speaker-badge');
    const speakerLabel = document.getElementById('live-speaker-label');
    const subtitleText = document.getElementById('live-subtitle-text');

    if (speakerBadge) {
      speakerBadge.className = `live-speaker-badge ${speaker === 'YOU' ? 'user-speaking' : ''}`;
    }
    if (speakerLabel) speakerLabel.textContent = speaker;
    if (subtitleText) {
      subtitleText.textContent = text;
      subtitleText.style.opacity = isInterim ? '0.75' : '1.0';
    }
    if (capsule) {
      capsule.style.borderColor = speaker === 'YOU' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 210, 255, 0.4)';
    }
  }

  // --------------------------------------------------------------------------
  // 5. WINDOW GLOBAL INTERACTION EXPORTS (PTT & CONTINUOUS)
  // --------------------------------------------------------------------------
  window.handleLiveMicClick = function() {
    // If VEDAS is speaking -> INTERRUPT IMMEDIATELY!
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      liveState.isSpeaking = false;
      showToast('Speech interrupted. Listening...', '⏹️');
      if (liveState.mode === 'continuous') {
        updateLiveUiState('listening');
        if (liveState.recognition) {
          try { liveState.recognition.start(); } catch(e){}
        }
      } else {
        updateLiveUiState('idle');
      }
      return;
    }

    if (liveState.mode === 'push_to_talk') {
      if (liveState.status === 'listening') {
        // Toggle off and send
        if (liveState.recognition) {
          try { liveState.recognition.stop(); } catch(e){}
        }
        if (liveState.accumulatedText && liveState.accumulatedText.trim().length > 0) {
          const text = liveState.accumulatedText.trim();
          liveState.accumulatedText = '';
          dispatchLiveTurn(text);
        } else {
          updateLiveUiState('idle');
          showToast('Mic turned off.', '⏸️');
        }
      } else if (liveState.status === 'idle') {
        // Toggle on
        liveState.accumulatedText = '';
        if (!liveState.recognition) initLiveSpeechEngine();
        if (liveState.recognition) {
          try { liveState.recognition.start(); } catch(e){}
        }
        updateLiveUiState('listening');
        showToast('Listening... Tap mic again to send query', '🎙️');
      }
      return;
    }

    // Continuous mode toggle
    if (liveState.status === 'listening') {
      if (liveState.recognition) {
        try { liveState.recognition.stop(); } catch(e){}
      }
      updateLiveUiState('idle');
      showToast('Microphone paused.', '⏸️');
    } else {
      if (!liveState.recognition) initLiveSpeechEngine();
      if (liveState.recognition) {
        try { liveState.recognition.start(); } catch(e){}
      }
      updateLiveUiState('listening');
      showToast('Listening...', '🎙️');
    }
  };

  // Hold-to-Talk Event Handlers for Push-to-Talk
  window.handleLiveMicMouseDown = function(e) {
    if (liveState.mode !== 'push_to_talk' || !liveState.active) return;
    
    // Interrupt if speaking
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      liveState.isSpeaking = false;
    }

    liveState.isPttHolding = true;
    liveState.pttStartTime = performance.now();
    liveState.accumulatedText = '';

    if (!liveState.recognition) initLiveSpeechEngine();
    if (liveState.recognition) {
      try { liveState.recognition.start(); } catch(e){}
    }
    updateLiveUiState('listening');
  };

  window.handleLiveMicMouseUp = function(e) {
    if (liveState.mode !== 'push_to_talk' || !liveState.isPttHolding || !liveState.active) return;
    liveState.isPttHolding = false;

    setTimeout(() => {
      if (liveState.recognition) {
        try { liveState.recognition.stop(); } catch(e){}
      }

      if (liveState.accumulatedText && liveState.accumulatedText.trim().length > 0) {
        const text = liveState.accumulatedText.trim();
        liveState.accumulatedText = '';
        dispatchLiveTurn(text);
      } else {
        updateLiveUiState('idle');
      }
    }, 250);
  };

  window.interruptLiveSpeech = function() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    liveState.isSpeaking = false;
    showToast('VEDAS speech interrupted.', '⏹️');
    if (liveState.mode === 'continuous') {
      updateLiveUiState('listening');
      if (liveState.recognition) {
        try { liveState.recognition.start(); } catch(e){}
      }
    } else {
      updateLiveUiState('idle');
    }
  };

  window.toggleLiveSpeaker = function() {
    liveState.speakerMuted = !liveState.speakerMuted;
    if (liveState.speakerMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const icon = document.getElementById('live-speaker-icon');
    if (icon) icon.textContent = liveState.speakerMuted ? '🔇' : '🔊';
    showToast(liveState.speakerMuted ? 'Voice speech output muted' : 'Voice speech output active', liveState.speakerMuted ? '🔇' : '🔊');
  };

  window.changeLivePersona = function(personaKey) {
    liveState.persona = personaKey || 'master_vedas';
    const cfg = LIVE_PERSONAS[liveState.persona] || LIVE_PERSONAS.master_vedas;
    showToast(`Live Voice Persona: ${cfg.name}`, '🎭');
  };

  window.setLiveInteractionMode = function(mode) {
    liveState.mode = mode;
    const btnCont = document.getElementById('btn-live-duplex-mode');
    const btnPtt = document.getElementById('btn-live-ptt-mode');
    const modeBadge = document.getElementById('live-mode-label');
    const micHint = document.getElementById('live-mic-hint');

    if (btnCont) btnCont.classList.toggle('active', mode === 'continuous');
    if (btnPtt) btnPtt.classList.toggle('active', mode === 'push_to_talk');
    if (modeBadge) modeBadge.textContent = mode === 'continuous' ? 'Voice-to-Voice Continuous' : 'Push-to-Talk Mode';

    if (mode === 'push_to_talk') {
      if (liveState.speechSilenceTimer) clearTimeout(liveState.speechSilenceTimer);
      if (liveState.recognition) {
        try { liveState.recognition.stop(); } catch(e){}
      }
      liveState.accumulatedText = '';
      updateLiveUiState('idle');
      if (micHint) micHint.textContent = 'Press & Hold or Tap to Speak';
      showToast('Push-to-Talk Mode active • Hold or click mic to speak', '🎯');
    } else {
      updateLiveUiState('listening');
      if (micHint) micHint.textContent = 'Tap to Interrupt / Talk';
      if (!liveState.recognition) initLiveSpeechEngine();
      if (liveState.recognition) {
        try { liveState.recognition.start(); } catch(e){}
      }
      showToast('Continuous Duplex Mode active • Speak naturally', '🔄');
    }
  };

  // --------------------------------------------------------------------------
  // 6. WEBCAM & NATIVE SCREEN VISION PIP
  // --------------------------------------------------------------------------
  window.toggleLiveCameraVision = async function() {
    const pip = document.getElementById('live-pip-vision-box');
    const video = document.getElementById('live-camera-video');
    const screenImg = document.getElementById('live-screen-preview-img');
    const tag = document.getElementById('live-camera-tag');
    const btn = document.getElementById('live-camera-toggle-btn');
    const pipTitle = document.getElementById('live-pip-title');

    if (liveState.cameraActive) {
      // Stop Camera
      if (liveState.mediaStream) {
        liveState.mediaStream.getTracks().forEach(t => t.stop());
        liveState.mediaStream = null;
      }
      liveState.cameraActive = false;
      if (tag) tag.textContent = 'OFF';
      if (btn) btn.classList.remove('active');
      if (pip && !liveState.screenActive) pip.style.display = 'none';
      if (video) video.style.display = 'none';
      showToast('Live Camera Vision disabled.', '📷');
    } else {
      // If Screen Vision is active, stop it first
      if (liveState.screenActive && liveState.screenStream) {
        liveState.screenStream.getTracks().forEach(t => t.stop());
        liveState.screenStream = null;
        liveState.screenActive = false;
        const sTag = document.getElementById('live-screen-tag');
        const sBtn = document.getElementById('live-screen-toggle-btn');
        if (sTag) sTag.textContent = 'OFF';
        if (sBtn) sBtn.classList.remove('active');
      }

      // Start Camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        liveState.mediaStream = stream;
        liveState.cameraActive = true;
        if (screenImg) screenImg.style.display = 'none';
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
        }
        if (pipTitle) pipTitle.textContent = '📷 LIVE WEBCAM FEED';
        if (pip) pip.style.display = 'block';
        if (tag) tag.textContent = 'ON';
        if (btn) btn.classList.add('active');
        showToast('Live Camera Vision active! Vedas can now see you & your surroundings.', '👁️');
      } catch (err) {
        showToast(`Camera access notice: ${err.message}`, '⚠️');
      }
    }
  };

  window.toggleLiveScreenVision = async function() {
    const pip = document.getElementById('live-pip-vision-box');
    const video = document.getElementById('live-camera-video');
    const screenImg = document.getElementById('live-screen-preview-img');
    const tag = document.getElementById('live-screen-tag');
    const btn = document.getElementById('live-screen-toggle-btn');
    const pipTitle = document.getElementById('live-pip-title');

    if (liveState.screenActive) {
      if (liveState.screenStream) {
        liveState.screenStream.getTracks().forEach(t => t.stop());
        liveState.screenStream = null;
      }
      liveState.screenActive = false;
      if (tag) tag.textContent = 'OFF';
      if (btn) btn.classList.remove('active');
      if (pip && !liveState.cameraActive) pip.style.display = 'none';
      if (screenImg) screenImg.style.display = 'none';
      showToast('Live Screen Vision disabled.', '🖥️');
    } else {
      // If Camera is active, stop it first
      if (liveState.cameraActive && liveState.mediaStream) {
        liveState.mediaStream.getTracks().forEach(t => t.stop());
        liveState.mediaStream = null;
        liveState.cameraActive = false;
        const cTag = document.getElementById('live-camera-tag');
        const cBtn = document.getElementById('live-camera-toggle-btn');
        if (cTag) cTag.textContent = 'OFF';
        if (cBtn) cBtn.classList.remove('active');
      }

      showToast('Select screen or window to share...', '🖥️');

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false
        });

        liveState.screenStream = stream;
        liveState.screenActive = true;

        // Auto-handle user clicking "Stop Sharing" on Chrome floating bar
        stream.getVideoTracks()[0].onended = () => {
          if (liveState.screenActive) toggleLiveScreenVision();
        };

        if (screenImg) screenImg.style.display = 'none';
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
        }
        if (pipTitle) pipTitle.textContent = '🖥️ SCREEN VISION (SHARING)';
        if (pip) pip.style.display = 'block';
        if (tag) tag.textContent = 'ON';
        if (btn) btn.classList.add('active');

        showToast('Screen Vision connected! Vedas is now monitoring your shared display.', '👁️');
      } catch (err) {
        console.warn('Screen sharing picker notice:', err);
        // Fallback to desktop screen capture
        try {
          const res = await fetch('/api/screen-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'Capture screen thumbnail' })
          });
          const data = await res.json();
          if (data.image_data) {
            liveState.screenActive = true;
            if (tag) tag.textContent = 'ON';
            if (btn) btn.classList.add('active');
            if (video) video.style.display = 'none';
            if (screenImg) {
              screenImg.src = data.image_data;
              screenImg.style.display = 'block';
            }
            if (pipTitle) pipTitle.textContent = '🖥️ DESKTOP SCREEN VISION';
            if (pip) pip.style.display = 'block';
            showToast('Screen Vision connected via Desktop capture.', '🖥️');
          } else {
            showToast('Screen Vision was cancelled.', '⚠️');
          }
        } catch (e) {
          showToast(`Screen access notice: ${err.message}`, '⚠️');
        }
      }
    }
  };

  window.closeLivePip = function() {
    const pip = document.getElementById('live-pip-vision-box');
    if (pip) pip.style.display = 'none';
  };

  function captureCameraSnapshot() {
    const video = document.getElementById('live-camera-video');
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function captureScreenSnapshot() {
    const video = document.getElementById('live-camera-video');
    if (liveState.screenStream && video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    const screenImg = document.getElementById('live-screen-preview-img');
    if (screenImg && screenImg.src && screenImg.src.startsWith('data:image')) {
      return screenImg.src;
    }
    return null;
  }

  window.captureLiveVisionSnapshot = function() {
    if (liveState.cameraActive) {
      const snap = captureCameraSnapshot();
      if (snap) {
        dispatchLiveTurn('Inspect what is visible in my camera right now and give a sharp overview.');
      } else {
        showToast('Camera feed not ready yet.', '⚠️');
      }
    } else if (liveState.screenActive) {
      const snap = captureScreenSnapshot();
      if (snap) {
        dispatchLiveTurn('Inspect what is currently on my screen and give a sharp overview.');
      } else {
        showToast('Screen feed not ready yet.', '⚠️');
      }
    } else {
      showToast('Please enable Camera or Screen Vision first.', '⚠️');
    }
  };

  window.triggerLiveQuickQuestion = function(questionText) {
    if (!questionText) return;
    if (questionText.toLowerCase().includes('summarize')) {
      const historyCtx = liveState.lastUserSpoken ? `Context of discussion: "${liveState.lastUserSpoken}". ` : '';
      dispatchLiveTurn(`${historyCtx}Please provide a direct, structured, and concise spoken summary of our conversation.`);
    } else {
      dispatchLiveTurn(questionText);
    }
  };

  // --------------------------------------------------------------------------
  // 7. LIFECYCLE HOOKS (START / STOP LIVE MODE)
  // --------------------------------------------------------------------------
  window.startLiveMode = function() {
    liveState.active = true;
    if (!visualizerInstance) {
      visualizerInstance = new LiveOrbVisualizer('live-orb-canvas');
    }
    visualizerInstance.resize();
    runVisualizerLoop();

    initLiveAudioAnalyzer();
    initLiveSpeechEngine();

    // Bind hold-to-talk listeners on central mic button if not already bound
    const micBtn = document.getElementById('live-mic-btn');
    if (micBtn && !micBtn._pttBound) {
      micBtn._pttBound = true;
      micBtn.addEventListener('mousedown', handleLiveMicMouseDown);
      micBtn.addEventListener('mouseup', handleLiveMicMouseUp);
      micBtn.addEventListener('mouseleave', handleLiveMicMouseUp);
      micBtn.addEventListener('touchstart', handleLiveMicMouseDown, { passive: true });
      micBtn.addEventListener('touchend', handleLiveMicMouseUp, { passive: true });
    }

    if (liveState.mode === 'continuous') {
      if (liveState.recognition) {
        try { liveState.recognition.start(); } catch(e){}
      }
      updateLiveUiState('listening');
      updateLiveSubtitle('VEDAS', 'Welcome to VEDAS Live Duplex. Start speaking anytime, or turn on Camera/Screen vision.', false);
    } else {
      updateLiveUiState('idle');
      updateLiveSubtitle('VEDAS', 'Push-to-Talk active. Press and hold or tap the mic orb to speak.', false);
    }

    showToast('🔴 VEDAS Live Duplex Mode Active', '✨');
  };

  window.stopLiveMode = function() {
    liveState.active = false;
    if (liveState.animFrameId) {
      cancelAnimationFrame(liveState.animFrameId);
      liveState.animFrameId = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (liveState.recognition) {
      try { liveState.recognition.stop(); } catch(e){}
    }
    if (liveState.mediaStream) {
      liveState.mediaStream.getTracks().forEach(t => t.stop());
      liveState.mediaStream = null;
      liveState.cameraActive = false;
    }
    if (liveState.screenStream) {
      liveState.screenStream.getTracks().forEach(t => t.stop());
      liveState.screenStream = null;
      liveState.screenActive = false;
    }
  };

  // Keyboard Spacebar Push-to-Talk Hold Shortcut in Live Mode
  window.addEventListener('keydown', (e) => {
    if (!liveState.active || liveState.mode !== 'push_to_talk') return;
    if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleLiveMicMouseDown();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!liveState.active || liveState.mode !== 'push_to_talk') return;
    if (e.code === 'Space') {
      e.preventDefault();
      handleLiveMicMouseUp();
    }
  });

})();
