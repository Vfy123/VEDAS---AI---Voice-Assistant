/**
 * Vedas AI — Dynamic Real-Time Audio Waveform Widget
 * States: 'idle', 'listening', 'speaking'
 */

class VedasWaveform {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; // 'idle' | 'listening' | 'speaking' | 'thinking'
    this.phase = 0;
    this.audioLevel = 0.5;

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
    this.animate();
  }

  initCanvasSize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const w = (parent && parent.clientWidth > 0) ? parent.clientWidth : 360;
    const h = (parent && parent.clientHeight > 0) ? parent.clientHeight : 38;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = w * dpr;
    this.height = h * dpr;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  setState(newState) {
    this.state = newState;
    const indicator = document.getElementById('dock-waveform-status') || document.getElementById('waveform-status-text');
    if (indicator) {
      if (newState === 'listening') {
        indicator.textContent = 'LISTENING...';
        indicator.style.color = '#ff9900';
      } else if (newState === 'speaking') {
        indicator.textContent = 'VEDAS SPEAKING';
        indicator.style.color = '#ff7700';
      } else if (newState === 'thinking') {
        indicator.textContent = 'INFERRING...';
        indicator.style.color = '#ffd166';
      } else {
        indicator.textContent = 'STANDBY';
        indicator.style.color = '#94a3b8';
      }
    }
  }

  animate() {
    if (!this.canvas) return;
    const { ctx, width, height, state } = this;

    ctx.clearRect(0, 0, width, height);
    const centerY = height / 2;

    if (state === 'idle') {
      // Ambient undulating line with dual Orange & Electric Cyan gradient
      this.phase += 0.035;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255, 119, 0, 0.15)');
      gradient.addColorStop(0.35, 'rgba(255, 140, 0, 0.85)');
      gradient.addColorStop(0.7, 'rgba(0, 210, 255, 0.9)');
      gradient.addColorStop(1, 'rgba(0, 150, 255, 0.2)');

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x < width; x += 4) {
        const envelope = Math.sin(Math.PI * (x / width));
        const y = centerY + Math.sin(x * 0.015 + this.phase) * (height * 0.1) * envelope;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00d2ff';
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (state === 'thinking') {
      // Dynamic neural pulse harmonic wave with Arc Blue, Cyan, Orange & Gold
      this.phase += 0.16;
      const baseAmp = height * 0.36;
      const layers = [
        { color: '#00d2ff', freq: 0.024, speed: 1.4, width: 2.5, glow: '#00d2ff' },
        { color: '#ff7700', freq: 0.030, speed: 1.1, width: 2.2, glow: '#ff7700' },
        { color: '#38bdf8', freq: 0.018, speed: 1.6, width: 1.8, glow: '#38bdf8' },
        { color: '#ffd166', freq: 0.012, speed: 0.8, width: 1.4, glow: '#ffd166' }
      ];

      layers.forEach((layer, idx) => {
        ctx.beginPath();
        const amp = baseAmp * (1.0 - idx * 0.18);
        for (let x = 0; x < width; x += 3) {
          const envelope = Math.sin(Math.PI * (x / width));
          const y = centerY + Math.sin(x * layer.freq + this.phase * layer.speed + idx * 1.6) * amp * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.shadowBlur = 16;
        ctx.shadowColor = layer.glow;
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
    } else {
      // Active states: 'speaking' or 'listening'
      this.phase += (state === 'speaking' ? 0.22 : 0.14);
      const baseAmp = state === 'speaking' ? height * 0.42 : height * 0.26;

      const layers = state === 'speaking'
        ? [
            { color: '#ff7700', freq: 0.018, speed: 1.0, width: 2.8, glow: '#ff7700' },
            { color: '#00d2ff', freq: 0.024, speed: 1.4, width: 2.2, glow: '#00d2ff' },
            { color: '#ffd166', freq: 0.032, speed: 0.8, width: 1.8, glow: '#ffd166' },
            { color: '#38bdf8', freq: 0.015, speed: 1.2, width: 1.4, glow: '#38bdf8' }
          ]
        : [
            { color: '#00d2ff', freq: 0.020, speed: 1.3, width: 2.6, glow: '#00d2ff' },
            { color: '#ff9900', freq: 0.026, speed: 1.1, width: 2.0, glow: '#ff9900' },
            { color: '#38bdf8', freq: 0.015, speed: 1.5, width: 1.6, glow: '#38bdf8' },
            { color: '#ffffff', freq: 0.032, speed: 0.8, width: 1.2, glow: '#ffffff' }
          ];

      layers.forEach((layer, idx) => {
        ctx.beginPath();
        const amp = baseAmp * (1.0 - idx * 0.15);
        for (let x = 0; x < width; x += 3) {
          const envelope = Math.sin(Math.PI * (x / width));
          const y = centerY + Math.sin(x * layer.freq + this.phase * layer.speed + idx * 1.5) * amp * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.shadowBlur = 14;
        ctx.shadowColor = layer.glow;
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(() => this.animate());
  }
}

// Global instances
window.vedasWaveform = null;
window.vedasDashWaveform = null;
window.vedasChatWaveform = null;
document.addEventListener('DOMContentLoaded', () => {
  window.vedasWaveform = new VedasWaveform('waveform-canvas');
  window.vedasDashWaveform = new VedasWaveform('dashboard-waveform');
  window.vedasChatWaveform = new VedasWaveform('chat-waveform');
});
