// Lazy Loading de Imágenes con IntersectionObserver
// Carga imágenes cuando están por entrar en viewport

(function() {
  'use strict';
  
  // Verificar soporte de IntersectionObserver
  if (!('IntersectionObserver' in window)) {
    console.warn('[LazyLoad] IntersectionObserver no soportado, cargando todas las imágenes');
    loadAllImages();
    return;
  }
  
  // Configuración del observer
  const config = {
    rootMargin: '50px 0px', // Precargar 50px antes de ser visible
    threshold: 0.01
  };
  
  // Crear observer
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }, config);
  
  /**
   * Cargar una imagen lazy
   */
  function loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;
    
    if (!src && !srcset) return;
    
    // Crear imagen temporal para verificar carga
    const tempImg = new Image();
    
    tempImg.onload = () => {
      if (srcset) img.srcset = srcset;
      if (src) img.src = src;
      img.classList.add('loaded');
      img.classList.remove('loading');
      console.log('[LazyLoad] ✅ Imagen cargada:', src || srcset);
    };
    
    tempImg.onerror = () => {
      console.error('[LazyLoad] ❌ Error cargando imagen:', src || srcset);
      img.classList.add('error');
      img.classList.remove('loading');
    };
    
    img.classList.add('loading');
    tempImg.src = src || srcset.split(',')[0].trim().split(' ')[0];
  }
  
  /**
   * Observar todas las imágenes lazy
   */
  function observeLazyImages() {
    const lazyImages = document.querySelectorAll('img[data-src], img[data-srcset]');
    
    if (lazyImages.length === 0) {
      console.log('[LazyLoad] No hay imágenes lazy para cargar');
      return;
    }
    
    console.log(`[LazyLoad] Observando ${lazyImages.length} imágenes`);
    
    lazyImages.forEach(img => {
      // Si la imagen ya está en viewport, cargar inmediatamente
      const rect = img.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        loadImage(img);
      } else {
        imageObserver.observe(img);
      }
    });
  }
  
  /**
   * Cargar todas las imágenes (fallback para navegadores antiguos)
   */
  function loadAllImages() {
    const lazyImages = document.querySelectorAll('img[data-src], img[data-srcset]');
    lazyImages.forEach(img => loadImage(img));
  }
  
  /**
   * Agregar soporte para imágenes de fondo
   */
  function observeLazyBackgrounds() {
    const lazyBackgrounds = document.querySelectorAll('[data-bg]');
    
    if (lazyBackgrounds.length === 0) return;
    
    const bgObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const bg = el.dataset.bg;
          el.style.backgroundImage = `url(${bg})`;
          el.classList.add('loaded');
          observer.unobserve(el);
        }
      });
    }, config);
    
    lazyBackgrounds.forEach(el => bgObserver.observe(el));
    console.log(`[LazyLoad] Observando ${lazyBackgrounds.length} fondos lazy`);
  }
  
  // Inicializar cuando el DOM esté listo
  function init() {
    observeLazyImages();
    observeLazyBackgrounds();
  }
  
  // Ejecutar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Exponer función global para re-observar cuando se carga contenido dinámico
  window.observeLazyImages = observeLazyImages;
  window.observeLazyBackgrounds = observeLazyBackgrounds;
  
  console.log('🖼️  Lazy Image Loader initialized');
})();
