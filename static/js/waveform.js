/**
 * Vedas AI — Dynamic Real-Time Audio Waveform Widget
 * States: 'idle', 'listening', 'speaking'
 */

class VedasWaveform {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; // 'idle' | 'listening' | 'speaking'
    this.phase = 0;
    this.audioLevel = 0.5;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = rect.width * window.devicePixelRatio || 600;
    this.height = this.canvas.height = rect.height * window.devicePixelRatio || 60;
  }

  setState(newState) {
    this.state = newState;
    const indicator = document.getElementById('waveform-status-text');
    if (indicator) {
      if (newState === 'listening') {
        indicator.textContent = 'VEDAS: LISTENING';
        indicator.style.color = '#ff2a85';
      } else if (newState === 'speaking') {
        indicator.textContent = 'VEDAS: SPEAKING';
        indicator.style.color = '#f5b83d';
      } else if (newState === 'thinking') {
        indicator.textContent = 'VEDAS: INFERRING (OLLAMA)';
        indicator.style.color = '#00f0ff';
      } else {
        indicator.textContent = 'VEDAS: IDLE';
        indicator.style.color = '#6b7280';
      }
    }
  }

  animate() {
    if (!this.canvas) return;
    const { ctx, width, height, state } = this;

    ctx.clearRect(0, 0, width, height);
    const centerY = height / 2;

    if (state === 'idle') {
      // Ambient undulating line
      this.phase += 0.03;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(0, 240, 255, 0.1)');
      gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.1)');

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x < width; x += 4) {
        const envelope = Math.sin(Math.PI * (x / width));
        const y = centerY + Math.sin(x * 0.015 + this.phase) * (height * 0.08) * envelope;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00f0ff';
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (state === 'thinking') {
      // Dynamic neural pulse harmonic wave during Ollama inference
      this.phase += 0.16;
      const baseAmp = height * 0.36;
      const layers = [
        { color: '#00f0ff', freq: 0.024, speed: 1.4, width: 2.2, glow: '#00f0ff' },
        { color: '#10b981', freq: 0.030, speed: 1.1, width: 1.8, glow: '#10b981' },
        { color: '#a855f7', freq: 0.018, speed: 1.6, width: 1.5, glow: '#a855f7' },
        { color: '#ffffff', freq: 0.012, speed: 0.8, width: 1.0, glow: '#ffffff' }
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
        ctx.shadowBlur = 14;
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
            { color: '#f5b83d', freq: 0.018, speed: 1.0, width: 2.5, glow: '#f5b83d' },
            { color: '#00f0ff', freq: 0.024, speed: 1.4, width: 2.0, glow: '#00f0ff' },
            { color: '#fb8c00', freq: 0.032, speed: 0.8, width: 1.8, glow: '#fb8c00' },
            { color: '#ffffff', freq: 0.015, speed: 1.2, width: 1.2, glow: '#ffffff' }
          ]
        : [
            { color: '#00f0ff', freq: 0.018, speed: 1.0, width: 2.5, glow: '#00f0ff' },
            { color: '#a855f7', freq: 0.024, speed: 1.4, width: 2.0, glow: '#a855f7' },
            { color: '#ff2a85', freq: 0.032, speed: 0.8, width: 1.8, glow: '#ff2a85' },
            { color: '#ffffff', freq: 0.015, speed: 1.2, width: 1.2, glow: '#ffffff' }
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
        ctx.shadowBlur = 12;
        ctx.shadowColor = layer.glow;
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(() => this.animate());
  }
}

// Global instance
window.vedasWaveform = null;
document.addEventListener('DOMContentLoaded', () => {
  window.vedasWaveform = new VedasWaveform('waveform-canvas');
});
