/**
 * Vedas AI — Neural Particle Background Canvas
 * Fluid particle network with glowing nodes and distance-based connections
 */

(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height;
  let particles = [];
  const particleCount = 75;
  const maxDistance = 140;

  const mouse = {
    x: null,
    y: null,
    radius: 160
  };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  let currentThemeKey = 'blue_orange';
  let strokeBase = 'rgba(0, 210, 255, ';

  window.updateParticleTheme = function(themeKey) {
    currentThemeKey = themeKey;
    if (themeKey === 'cyan_amber') strokeBase = 'rgba(6, 182, 212, ';
    else if (themeKey === 'emerald_neon') strokeBase = 'rgba(16, 185, 129, ';
    else if (themeKey === 'crimson_violet') strokeBase = 'rgba(168, 85, 247, ';
    else if (themeKey === 'midnight_blue') strokeBase = 'rgba(59, 130, 246, ';
    else strokeBase = 'rgba(0, 210, 255, ';

    particles.forEach(p => p.retheme(themeKey));
  };

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2 + 1;
      this.retheme(currentThemeKey);
      this.alpha = Math.random() * 0.55 + 0.3;
    }

    retheme(tKey) {
      const r = Math.random();
      if (tKey === 'cyan_amber') {
        if (r > 0.5) { this.baseColor = 'rgba(6, 182, 212,'; this.glowColor = '#06b6d4'; }
        else { this.baseColor = 'rgba(245, 158, 11,'; this.glowColor = '#f59e0b'; }
      } else if (tKey === 'emerald_neon') {
        if (r > 0.5) { this.baseColor = 'rgba(16, 185, 129,'; this.glowColor = '#10b981'; }
        else { this.baseColor = 'rgba(6, 182, 212,'; this.glowColor = '#06b6d4'; }
      } else if (tKey === 'crimson_violet') {
        if (r > 0.5) { this.baseColor = 'rgba(168, 85, 247,'; this.glowColor = '#a855f7'; }
        else { this.baseColor = 'rgba(244, 63, 94,'; this.glowColor = '#f43f5e'; }
      } else if (tKey === 'midnight_blue') {
        if (r > 0.5) { this.baseColor = 'rgba(59, 130, 246,'; this.glowColor = '#3b82f6'; }
        else { this.baseColor = 'rgba(249, 115, 22,'; this.glowColor = '#f97316'; }
      } else {
        if (r > 0.5) { this.baseColor = 'rgba(0, 210, 255,'; this.glowColor = '#00d2ff'; }
        else { this.baseColor = 'rgba(255, 123, 0,'; this.glowColor = '#ff7b00'; }
      }
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse interactive push/pull
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 3;
          this.y -= (dy / dist) * force * 3;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${this.baseColor}${this.alpha})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.glowColor;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function connect() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a + 1; b < particles.length; b++) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          const opacity = (1 - dist / maxDistance) * 0.25;
          ctx.strokeStyle = `${strokeBase}${opacity})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    for (let p of particles) {
      p.update();
      p.draw();
    }
    connect();
    requestAnimationFrame(animate);
  }

  init();
  animate();
})();
