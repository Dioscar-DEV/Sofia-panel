/**
 * Sistema de Partículas de Fondo con Gradiente
 * Efecto visual sutil para el fondo general del sistema
 */

class BackgroundParticles {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      particleCount: options.particleCount || 18,
      particleSize: options.particleSize || { min: 50, max: 130 },
      speed: options.speed || { min: 0.08, max: 0.22 },
      fadeSpeed: options.fadeSpeed || 0.0025,
      gradientColors: options.gradientColors || [
        { r: 32, g: 64, b: 128 },     // Azul principal
        { r: 59, g: 91, b: 167 },     // Azul claro
        { r: 70, g: 102, b: 176 },    // Azul medio
        { r: 43, g: 75, b: 140 }      // Azul oscuro
      ]
    };
    
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.resizeObserver = null;
    
    this.init();
  }

  init() {
    // Crear canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '-1';
    this.canvas.style.opacity = '1';
    this.canvas.style.mixBlendMode = 'normal';
    
    // Insertar como primer hijo del body
    document.body.insertBefore(this.canvas, document.body.firstChild);
    this.ctx = this.canvas.getContext('2d');
    
    // Configurar tamaño del canvas
    this.resize();
    
    // Crear partículas
    this.createParticles();
    
    // Observar cambios de tamaño
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.body);
    
    // Iniciar animación
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.options.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const size = this.random(this.options.particleSize.min, this.options.particleSize.max);
    const colorIndex = Math.floor(Math.random() * this.options.gradientColors.length);
    
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      size: size,
      baseSize: size,
      speedX: this.random(-this.options.speed.max, this.options.speed.max),
      speedY: this.random(-this.options.speed.max, this.options.speed.max),
      angle: Math.random() * Math.PI * 2,
      angleSpeed: this.random(-0.003, 0.003),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: this.random(0.005, 0.015),
      opacity: this.random(0.15, 0.35),
      targetOpacity: this.random(0.2, 0.4),
      fadeDirection: 1,
      color: this.options.gradientColors[colorIndex],
      gradientOffset: Math.random() * 0.3
    };
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  updateParticle(particle) {
    // Movimiento ondulatorio tipo agua lento
    particle.angle += particle.angleSpeed;
    particle.pulsePhase += particle.pulseSpeed;
    
    // Movimiento suave con onda sinusoidal
    const waveX = Math.sin(particle.angle) * 0.3;
    const waveY = Math.cos(particle.angle * 0.7) * 0.3;
    
    particle.x += particle.speedX + waveX;
    particle.y += particle.speedY + waveY;
    
    // Efecto de pulsación suave en el tamaño
    particle.size = particle.baseSize + Math.sin(particle.pulsePhase) * (particle.baseSize * 0.15);
    
    // Efecto de fade in/out gradual más sutil
    if (particle.opacity < particle.targetOpacity && particle.fadeDirection === 1) {
      particle.opacity += this.options.fadeSpeed;
      if (particle.opacity >= particle.targetOpacity) {
        particle.fadeDirection = -1;
        particle.targetOpacity = this.random(0.1, 0.25);
      }
    } else if (particle.opacity > particle.targetOpacity && particle.fadeDirection === -1) {
      particle.opacity -= this.options.fadeSpeed;
      if (particle.opacity <= particle.targetOpacity) {
        particle.fadeDirection = 1;
        particle.targetOpacity = this.random(0.2, 0.4);
      }
    }
    
    particle.opacity = Math.max(0.08, Math.min(0.45, particle.opacity));
    
    // Rebote en los bordes con margen
    const margin = particle.size;
    if (particle.x < -margin || particle.x > this.canvas.width + margin) {
      particle.speedX *= -1;
      particle.x = Math.max(-margin, Math.min(this.canvas.width + margin, particle.x));
    }
    
    if (particle.y < -margin || particle.y > this.canvas.height + margin) {
      particle.speedY *= -1;
      particle.y = Math.max(-margin, Math.min(this.canvas.height + margin, particle.y));
    }
  }

  drawParticle(particle) {
    const c = particle.color;
    const baseOpacity = particle.opacity;
    
    // Crear gradiente radial
    const gradient = this.ctx.createRadialGradient(
      particle.x, 
      particle.y, 
      0,
      particle.x, 
      particle.y, 
      particle.size
    );
    
    // Gradiente blanco más visible
    gradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseOpacity})`);
    gradient.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseOpacity * 0.7})`);
    gradient.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseOpacity * 0.4})`);
    gradient.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
    
    // Dibujar círculo con gradiente sin borde
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  animate() {
    // Limpiar completamente el canvas en cada frame
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Actualizar y dibujar partículas
    this.particles.forEach(particle => {
      this.updateParticle(particle);
      this.drawParticle(particle);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.particles = [];
  }
}

// Inicialización global
window.backgroundParticles = null;

// Auto-inicializar cuando el DOM esté listo
function initBackgroundParticles() {
  if (window.backgroundParticles) {
    window.backgroundParticles.destroy();
  }
  
  window.backgroundParticles = new BackgroundParticles(document.body, {
    particleCount: 12,
    particleSize: { min: 30, max: 80 },
    speed: { min: 0.03, max: 0.1 },
    fadeSpeed: 0.0008,
    gradientColors: [
      { r: 255, g: 255, b: 255 },   // Blanco puro
      { r: 250, g: 250, b: 250 },   // Blanco suave
      { r: 245, g: 245, b: 250 },   // Blanco con tinte azul muy sutil
      { r: 248, g: 248, b: 255 }    // Blanco con tinte azul
    ]
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackgroundParticles);
} else {
  initBackgroundParticles();
}
