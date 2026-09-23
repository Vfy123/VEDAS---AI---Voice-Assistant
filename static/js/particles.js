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

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2 + 1;
      const r = Math.random();
      if (r > 0.65) {
        // High-voltage Electric Cyan / Arc Blue
        this.baseColor = 'rgba(0, 210, 255,';
        this.glowColor = '#00d2ff';
      } else if (r > 0.45) {
        // Cyber Azure / Royal Blue
        this.baseColor = 'rgba(56, 189, 248,';
        this.glowColor = '#38bdf8';
      } else if (r > 0.22) {
        // JARVIS Blazing Orange
        this.baseColor = 'rgba(255, 119, 0,';
        this.glowColor = '#ff7700';
      } else {
        // Glowing Gold
        this.baseColor = 'rgba(245, 184, 61,';
        this.glowColor = '#f5b83d';
      }
      this.alpha = Math.random() * 0.55 + 0.3;
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
          ctx.strokeStyle = `rgba(0, 240, 255, ${opacity})`;
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
