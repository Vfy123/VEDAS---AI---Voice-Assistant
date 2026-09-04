/**
 * VEDAS AI — JARVIS Hologram Animation Engine
 * Renders a cinematic JARVIS-style holographic display with
 * reactive animations for AI speaking and User speaking states.
 */

class JarvisHologram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'idle'; // 'idle' | 'ai_speaking' | 'user_speaking'
    this.animFrame = null;
    this.time = 0;
    this.particles = [];
    this.rings = [];
    this.ripples = [];
    this.pulseRadius = 0;
    this.pulseAlpha = 0;
    this.intensity = 0;
    this.targetIntensity = 0;
    this.visible = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initRings();
    this.initParticles();
  }

  resize() {
    const size = this.canvas.parentElement.offsetWidth || 200;
    this.canvas.width = size;
    this.canvas.height = size;
    this.cx = size / 2;
    this.cy = size / 2;
    this.radius = size * 0.38;
  }

  initRings() {
    this.rings = [
      { r: this.radius * 0.35, speed: 0.008, alpha: 0.6, dash: [8, 5], width: 1.5 },
      { r: this.radius * 0.55, speed: -0.005, alpha: 0.45, dash: [16, 8], width: 1 },
      { r: this.radius * 0.72, speed: 0.004, alpha: 0.35, dash: [4, 12], width: 0.8 },
      { r: this.radius * 0.90, speed: -0.003, alpha: 0.25, dash: [20, 6], width: 0.7 },
      { r: this.radius * 1.05, speed: 0.002, alpha: 0.15, dash: [6, 18], width: 0.5 }
    ];
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const angle = Math.random() * Math.PI * 2;
    const dist = (Math.random() * 0.7 + 0.15) * this.radius;
    return {
      x: this.cx + Math.cos(angle) * dist,
      y: this.cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: Math.random(),
      maxLife: 0.5 + Math.random() * 1.5,
      size: 0.5 + Math.random() * 1.5,
      angle,
      dist
    };
  }

  setState(newState) {
    this.state = newState;

    if (newState === 'idle') {
      this.targetIntensity = 0;
      this.hide();
    } else {
      this.show();
      if (newState === 'ai_speaking') {
        this.targetIntensity = 1.0;
        this.addRipple('ai');
      } else if (newState === 'ai_thinking') {
        this.targetIntensity = 0.65;
        this.addRipple('ai');
      } else if (newState === 'user_speaking') {
        this.targetIntensity = 0.85;
        this.addRipple('user');
      }
    }
  }

  addRipple(type) {
    this.ripples.push({
      r: this.radius * 0.2,
      maxR: this.radius * 1.3,
      alpha: 0.8,
      type,
      speed: type === 'ai' ? 3 : 2
    });
  }

  show() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    wrap.classList.add('visible');
    wrap.style.display = 'flex';
    wrap.style.transition = 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
    wrap.style.opacity = '1';
    wrap.style.transform = 'scale(1)';
    this.visible = true;
    if (!this.animFrame) this.loop();
  }

  hide() {
    const wrap = this.canvas.parentElement;
    wrap.classList.remove('visible');
    wrap.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
    wrap.style.opacity = '0';
    wrap.style.transform = 'scale(0.9)';
    setTimeout(() => {
      if (this.state === 'idle') {
        this.visible = false;
        wrap.style.display = 'none';
        if (this.animFrame) {
          cancelAnimationFrame(this.animFrame);
          this.animFrame = null;
        }
      }
    }, 280);
  }

  loop() {
    this.animFrame = requestAnimationFrame(() => this.loop());
    this.draw();
  }

  draw() {
    const { ctx, cx, cy } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Smooth intensity transition
    const diff = this.targetIntensity - this.intensity;
    this.intensity += diff * 0.04;
    this.time += 0.016;

    const isAI = this.state === 'ai_speaking';
    const isUser = this.state === 'user_speaking';
    const isActive = isAI || isUser;

    // Color palette: JARVIS gold/amber for AI, cyan-blue for user
    const aiColor = { r: 251, g: 176, b: 59 };   // amber/gold
    const userColor = { r: 0, g: 212, b: 255 };   // cyan
    const idleColor = { r: 0, g: 180, b: 200 };   // dim cyan

    let col = idleColor;
    if (isAI) col = aiColor;
    else if (isUser) col = userColor;

    const colStr = `rgba(${col.r},${col.g},${col.b}`;

    // Background glow disk
    if (isActive) {
      const glowR = this.radius * (1.1 + 0.08 * Math.sin(this.time * 3));
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `${colStr},${0.12 * this.intensity})`);
      grd.addColorStop(0.5, `${colStr},${0.06 * this.intensity})`);
      grd.addColorStop(1, `${colStr},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ripple waves
    this.ripples = this.ripples.filter(rip => rip.alpha > 0.02);
    for (const rip of this.ripples) {
      const c = rip.type === 'ai' ? aiColor : userColor;
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${rip.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, rip.r, 0, Math.PI * 2);
      ctx.stroke();
      rip.r += rip.speed;
      rip.alpha *= 0.96;
    }

    // Rotating dashed rings
    this.rings.forEach((ring, i) => {
      const ringR = ring.r * (this.canvas.width / (this.canvas.width || 200));
      const rot = this.time * ring.speed * (30 + this.intensity * 20);
      const alpha = ring.alpha * (0.5 + 0.5 * this.intensity) * (isActive ? 1 : 0.45);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = `${colStr},${alpha})`;
      ctx.lineWidth = ring.width * (1 + this.intensity * 0.5);
      ctx.setLineDash(ring.dash);
      ctx.lineDashOffset = -this.time * 15;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    ctx.setLineDash([]);

    // Core sphere
    const coreR = this.radius * 0.22 * (1 + 0.04 * Math.sin(this.time * 4 * (1 + this.intensity)));
    const coreGrd = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, 0, cx, cy, coreR);
    coreGrd.addColorStop(0, `${colStr},${0.95})`);
    coreGrd.addColorStop(0.4, `${colStr},${0.75})`);
    coreGrd.addColorStop(1, `${colStr},0.1)`);
    ctx.fillStyle = coreGrd;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Core highlight
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.3 * this.intensity})`;
    ctx.beginPath();
    ctx.arc(cx - coreR * 0.3, cy - coreR * 0.3, coreR * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Equalizer bars (only when speaking)
    if (isActive) {
      const barCount = isAI ? 32 : 24;
      const barAngleStep = (Math.PI * 2) / barCount;
      const innerBarR = this.radius * 0.28;
      const maxBarH = this.radius * (isAI ? 0.22 : 0.18);

      for (let i = 0; i < barCount; i++) {
        const angle = i * barAngleStep + this.time * (isAI ? 0.5 : 0.3);
        const waveVal = Math.sin(this.time * (isAI ? 8 : 5) + i * 0.5) * 0.5 + 0.5;
        const noiseVal = Math.sin(this.time * 12 + i * 0.8) * 0.3 + 0.5;
        const barH = maxBarH * this.intensity * (waveVal * 0.6 + noiseVal * 0.4 + 0.15);

        const x1 = cx + Math.cos(angle) * innerBarR;
        const y1 = cy + Math.sin(angle) * innerBarR;
        const x2 = cx + Math.cos(angle) * (innerBarR + barH);
        const y2 = cy + Math.sin(angle) * (innerBarR + barH);

        const barAlpha = 0.5 + 0.5 * waveVal;
        ctx.strokeStyle = `${colStr},${barAlpha})`;
        ctx.lineWidth = isAI ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Floating particles (update)
    const maxParticles = isActive ? 40 : 12;
    if (this.particles.length < maxParticles) {
      this.particles.push(this.createParticle());
    }

    this.particles = this.particles.filter(p => {
      p.life += 0.008;
      if (p.life > p.maxLife) return false;

      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.sin(lifeRatio * Math.PI) * 0.6 * (isActive ? 1 : 0.3);
      const size = p.size * (0.5 + 0.5 * Math.sin(lifeRatio * Math.PI));

      // Orbital movement
      p.angle += (isAI ? 0.008 : 0.005) * (1 + this.intensity * 0.5);
      p.dist += Math.sin(this.time * 2 + p.angle) * 0.2;
      if (p.dist < 0.1 * this.radius) p.dist = 0.1 * this.radius;
      if (p.dist > 0.95 * this.radius) p.dist = 0.95 * this.radius;

      p.x = cx + Math.cos(p.angle) * p.dist;
      p.y = cy + Math.sin(p.angle) * p.dist;

      ctx.fillStyle = `${colStr},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // State label
    const labelY = cy + this.radius * 1.3;
    const labels = { idle: 'STANDBY', ai_speaking: 'VEDAS ACTIVE', user_speaking: 'LISTENING...' };
    const labelAlpha = isActive ? (0.8 + 0.2 * Math.sin(this.time * 3)) : 0.4;
    ctx.fillStyle = `${colStr},${labelAlpha})`;
    ctx.font = `600 ${Math.max(9, this.canvas.width * 0.07)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText(labels[this.state] || 'STANDBY', cx, labelY);

    // Scan line effect when AI speaking
    if (isAI && this.intensity > 0.3) {
      const scanY = cy + (this.radius * 1.1) * ((Math.sin(this.time * 1.5) * 0.5 + 0.5) * 2 - 1);
      ctx.strokeStyle = `${colStr},${0.15 * this.intensity})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx - this.radius * 1.1, scanY);
      ctx.lineTo(cx + this.radius * 1.1, scanY);
      ctx.stroke();
    }

    // Cross-hair lines
    const crossAlpha = 0.12 + 0.06 * this.intensity;
    ctx.strokeStyle = `${colStr},${crossAlpha})`;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - this.radius * 1.15);
    ctx.lineTo(cx, cy + this.radius * 1.15);
    ctx.moveTo(cx - this.radius * 1.15, cy);
    ctx.lineTo(cx + this.radius * 1.15, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Initialize and expose globally
window.VedasHologram = null;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('hologram-canvas');
  if (canvas) {
    window.VedasHologram = new JarvisHologram(canvas);
  }
});
