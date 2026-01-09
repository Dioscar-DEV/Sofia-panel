/**
 * Sistema de Partículas Flotantes Tipo Agua
 * Efecto visual para headers del sistema
 */

class WaterParticles {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      particleCount: options.particleCount || 25,
      particleColor: options.particleColor || 'rgba(255, 255, 255, 0.25)',
      particleSize: options.particleSize || { min: 6, max: 14 },
      speed: options.speed || { min: 0.05, max: 0.3 },
      connectionDistance: options.connectionDistance || 100,
      lineColor: options.lineColor || 'rgba(255, 255, 255, 0.1)',
      lineWidth: options.lineWidth || 0.3
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
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1';
    this.canvas.style.opacity = '0.6';
    
    // Asegurar que el contenedor tenga position relative
    const position = window.getComputedStyle(this.container).position;
    if (position === 'static') {
      this.container.style.position = 'relative';
    }
    
    // Asegurar que el contenedor tenga overflow hidden
    this.container.style.overflow = 'hidden';
    
    this.container.insertBefore(this.canvas, this.container.firstChild);
    this.ctx = this.canvas.getContext('2d');
    
    // Configurar tamaño del canvas
    this.resize();
    
    // Crear partículas
    this.createParticles();
    
    // Observar cambios de tamaño
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    
    // Iniciar animación
    this.animate();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.options.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const size = this.random(this.options.particleSize.min, this.options.particleSize.max);
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      size: size,
      baseSize: size,
      speedX: this.random(-this.options.speed.max, this.options.speed.max),
      speedY: this.random(-this.options.speed.max, this.options.speed.max),
      angle: Math.random() * Math.PI * 2,
      angleSpeed: this.random(-0.005, 0.005),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: this.random(0.008, 0.02)
    };
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  updateParticle(particle) {
    // Movimiento ondulatorio tipo agua
    particle.angle += particle.angleSpeed;
    particle.pulsePhase += particle.pulseSpeed;
    
    // Movimiento suave con onda sinusoidal
    const waveX = Math.sin(particle.angle) * 0.2;
    const waveY = Math.cos(particle.angle * 0.8) * 0.2;
    
    particle.x += particle.speedX + waveX;
    particle.y += particle.speedY + waveY;
    
    // Efecto de pulsación suave en el tamaño
    particle.size = particle.baseSize + Math.sin(particle.pulsePhase) * 1.2;
    
    // Rebote en los bordes
    if (particle.x < 0 || particle.x > this.canvas.width) {
      particle.speedX *= -1;
      particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
    }
    
    if (particle.y < 0 || particle.y > this.canvas.height) {
      particle.speedY *= -1;
      particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));
    }
  }

  drawParticle(particle) {
    // Burbuja simple con gradiente sutil
    const gradient = this.ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size
    );
    gradient.addColorStop(0, this.options.particleColor);
    gradient.addColorStop(0.7, this.options.particleColor.replace(/[\d.]+\)$/, '0.05)'));
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  drawConnections() {
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.options.connectionDistance) {
          const opacity = 1 - (distance / this.options.connectionDistance);
          this.ctx.beginPath();
          this.ctx.strokeStyle = this.options.lineColor.replace(/[\d.]+\)$/, `${opacity * 0.15})`);
          this.ctx.lineWidth = this.options.lineWidth;
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Actualizar y dibujar partículas
    this.particles.forEach(particle => {
      this.updateParticle(particle);
      this.drawParticle(particle);
    });
    
    // Dibujar conexiones entre partículas
    this.drawConnections();
    
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

// Sistema de inicialización automática para headers
class WaterParticlesManager {
  constructor() {
    this.instances = new Map();
    this.observer = null;
  }

  init() {
    // Observar módulos que se cargan dinámicamente
    this.observeDynamicHeaders();
  }

  applyToElement(selector, options = {}) {
    const element = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;
    
    if (!element) return null;
    
    // Evitar duplicados
    if (this.instances.has(element)) {
      return this.instances.get(element);
    }
    
    const instance = new WaterParticles(element, options);
    this.instances.set(element, instance);
    return instance;
  }

  observeDynamicHeaders() {
    // Observar cambios en el DOM para headers de módulos
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Buscar headers en el nodo agregado
            this.applyToModuleHeaders(node);
          }
        });
      });
    });

    // Observar el contenedor principal de la app
    const appMain = document.querySelector('.app-main');
    if (appMain) {
      this.observer.observe(appMain, {
        childList: true,
        subtree: true
      });
    }

    // Aplicar a headers existentes
    setTimeout(() => this.applyToAllExistingHeaders(), 500);
  }

  applyToModuleHeaders(container) {
    const selectors = [
      '.management-header',
      '.home-header',
      '.sd-header',
      '.indice-header',
      '.dashboard-header',
      '.contacts-header',
      '[class*="header"][class*="module"]',
      'header[class*="panel"]'
    ];

    selectors.forEach(selector => {
      const headers = container.querySelectorAll 
        ? container.querySelectorAll(selector)
        : (container.matches && container.matches(selector) ? [container] : []);
      
      headers.forEach(header => {
        if (!this.instances.has(header)) {
          this.applyToElement(header, {
            particleCount: 15,
            particleColor: 'rgba(255, 255, 255, 0.2)',
            lineColor: 'rgba(255, 255, 255, 0.08)',
            speed: { min: 0.05, max: 0.4 },
            particleSize: { min: 8, max: 16 }
          });
        }
      });
    });
  }

  applyToAllExistingHeaders() {
    // Aplicar a todos los headers que ya existen en el DOM
    const container = document.body;
    this.applyToModuleHeaders(container);
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.instances.forEach(instance => instance.destroy());
    this.instances.clear();
  }
}

// Instancia global
window.waterParticlesManager = new WaterParticlesManager();

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.waterParticlesManager.init();
  });
} else {
  window.waterParticlesManager.init();
}
