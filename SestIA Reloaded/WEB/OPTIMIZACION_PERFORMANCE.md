# 🚀 Guía de Optimización de Performance - SestIA Project

**Fecha:** Enero 9, 2026  
**Objetivo:** Mejorar significativamente el rendimiento del sistema

---

## 📊 Análisis Actual

### Estado Actual del Proyecto:
- ✅ Arquitectura SPA (Single Page Application)
- ✅ Módulos cargados dinámicamente
- ✅ Supabase para backend
- ⚠️ Sin minificación de assets
- ⚠️ Sin caché de recursos
- ⚠️ Sin lazy loading de imágenes
- ⚠️ Sin compresión HTTP
- ⚠️ Múltiples requests sin optimizar

---

## 🎯 Mejoras Prioritarias

### 1. **Optimización del Servidor Express**

#### Problema Actual:
```javascript
// server.js - Sin optimizaciones
app.use(express.static(__dirname));
```

#### Solución: Cache Headers + Compresión
```javascript
const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Habilitar compresión GZIP
app.use(compression({
  level: 6, // Balance entre velocidad y compresión
  threshold: 1024, // Solo comprimir archivos > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ✅ Cache headers agresivos para assets estáticos
app.use(express.static(__dirname, {
  maxAge: '1y', // 1 año para assets versionados
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // HTML sin cache (siempre fresh)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // CSS/JS con cache medio (1 semana)
    else if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 días
    }
    // Imágenes con cache largo (1 mes)
    else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 días
    }
    // Fuentes con cache muy largo (1 año)
    else if (filePath.match(/\.(woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ✅ Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor optimizado en puerto ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`⚡ Compresión GZIP: Activa`);
  console.log(`💾 Cache Headers: Configurados`);
});
```

**Impacto:**
- 📉 **Reducción de tamaño:** 60-80% con GZIP
- ⚡ **Velocidad:** 3-5x más rápido en visitas subsecuentes
- 🌐 **Ancho de banda:** -70% de uso

---

### 2. **Lazy Loading de Imágenes**

#### Implementación en HTML:
```html
<!-- Antes -->
<img src="assets/logo.svg" alt="Logo">

<!-- Después -->
<img 
  src="assets/placeholder.svg" 
  data-src="assets/logo.svg" 
  alt="Logo"
  loading="lazy"
  class="lazy-image"
>
```

#### Script de Lazy Loading:
```javascript
// lazy-images.js
(function() {
  'use strict';
  
  // Observer API (moderna y eficiente)
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        
        if (src) {
          img.src = src;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px' // Precargar 50px antes de ser visible
  });
  
  // Observar todas las imágenes lazy
  function observeLazyImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => imageObserver.observe(img));
  }
  
  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLazyImages);
  } else {
    observeLazyImages();
  }
  
  // Re-observar cuando se carga contenido dinámico
  window.observeLazyImages = observeLazyImages;
})();
```

**CSS de soporte:**
```css
.lazy-image {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lazy-image.loaded {
  opacity: 1;
}
```

---

### 3. **Debouncing en Búsquedas y Filtros**

#### Problema: Búsqueda ejecuta en cada tecla
```javascript
// Antes - reportes/init.js
searchInput.addEventListener('keypress', (e) => {
  if(e.key === 'Enter'){ 
    fetchReports(); 
  }
});
```

#### Solución: Debounce utility
```javascript
// utils/debounce.js
window.debounce = function(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Implementación en reportes
const debouncedSearch = debounce(() => {
  state.currentPage = 1;
  fetchReports();
}, 300);

searchInput.addEventListener('input', debouncedSearch);
```

**Impacto:**
- 🔥 **Requests:** -90% en búsquedas
- ⚡ **Experiencia:** Más fluida
- 💾 **Recursos:** Menos carga en servidor

---

### 4. **Preload de Recursos Críticos**

#### En `index.html`:
```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sofia - Sistema Agéntico</title>
  
  <!-- ✅ Preconnect a Supabase -->
  <link rel="preconnect" href="https://fxhiefkmptijsucfqmyf.supabase.co">
  <link rel="dns-prefetch" href="https://fxhiefkmptijsucfqmyf.supabase.co">
  
  <!-- ✅ Preload de fuentes críticas -->
  <link rel="preload" href="assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  
  <!-- ✅ Preload CSS crítico -->
  <link rel="preload" href="styles.css" as="style">
  <link rel="stylesheet" href="styles.css">
  
  <!-- ✅ Preload scripts críticos -->
  <link rel="modulepreload" href="config.js">
  <link rel="modulepreload" href="core.js">
  
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml" />
</head>
```

---

### 5. **LocalStorage Cache para Datos**

#### Implementación de Cache Manager:
```javascript
// cache-manager.js
window.CacheManager = {
  TTL: {
    SHORT: 5 * 60 * 1000,      // 5 minutos
    MEDIUM: 30 * 60 * 1000,    // 30 minutos
    LONG: 24 * 60 * 60 * 1000  // 24 horas
  },
  
  set(key, data, ttl = this.TTL.MEDIUM) {
    try {
      const item = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
      console.log(`[Cache] Guardado: ${key}`);
    } catch (e) {
      console.error('[Cache] Error guardando:', e);
    }
  },
  
  get(key) {
    try {
      const itemStr = localStorage.getItem(`cache_${key}`);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      const now = Date.now();
      
      // Verificar si expiró
      if (now - item.timestamp > item.ttl) {
        this.remove(key);
        console.log(`[Cache] Expirado: ${key}`);
        return null;
      }
      
      console.log(`[Cache] Hit: ${key}`);
      return item.data;
    } catch (e) {
      console.error('[Cache] Error leyendo:', e);
      return null;
    }
  },
  
  remove(key) {
    localStorage.removeItem(`cache_${key}`);
  },
  
  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('[Cache] Limpiado completamente');
  }
};

// Uso en módulos
async function fetchReportsWithCache() {
  const cacheKey = 'reportes_list';
  
  // Intentar desde cache primero
  const cached = CacheManager.get(cacheKey);
  if (cached) {
    state.items = cached.data;
    state.totalItems = cached.total;
    renderList();
    return;
  }
  
  // Si no hay cache, fetch normal
  const { data, error } = await supabase.rpc('reportes_list_filtrado', params);
  
  if (!error && data) {
    // Guardar en cache
    CacheManager.set(cacheKey, data, CacheManager.TTL.SHORT);
    state.items = data.data;
    state.totalItems = data.total;
    renderList();
  }
}
```

---

### 6. **Virtual Scrolling para Listas Grandes**

#### Problema: Renderizar 1000+ items = lag
```javascript
// Antes - Render todos los items
state.items.forEach(item => {
  listEl.appendChild(createItemElement(item));
});
```

#### Solución: Virtual Scrolling
```javascript
// virtual-scroll.js
class VirtualScroller {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleStart = 0;
    this.visibleCount = 0;
    
    this.init();
  }
  
  init() {
    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-scroll-viewport';
    this.viewport.style.height = '600px';
    this.viewport.style.overflow = 'auto';
    
    this.content = document.createElement('div');
    this.content.className = 'virtual-scroll-content';
    
    this.viewport.appendChild(this.content);
    this.container.appendChild(this.viewport);
    
    this.viewport.addEventListener('scroll', () => this.onScroll());
    this.calculateVisible();
  }
  
  setItems(items) {
    this.items = items;
    this.content.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }
  
  calculateVisible() {
    const viewportHeight = this.viewport.clientHeight;
    this.visibleCount = Math.ceil(viewportHeight / this.itemHeight) + 5; // +5 buffer
  }
  
  onScroll() {
    this.visibleStart = Math.floor(this.viewport.scrollTop / this.itemHeight);
    this.render();
  }
  
  render() {
    const fragment = document.createDocumentFragment();
    const start = Math.max(0, this.visibleStart - 2);
    const end = Math.min(this.items.length, this.visibleStart + this.visibleCount + 2);
    
    this.content.innerHTML = '';
    this.content.style.paddingTop = `${start * this.itemHeight}px`;
    
    for (let i = start; i < end; i++) {
      const item = this.items[i];
      const el = this.renderItem(item, i);
      el.style.height = `${this.itemHeight}px`;
      fragment.appendChild(el);
    }
    
    this.content.appendChild(fragment);
  }
}

// Uso en reportes
const scroller = new VirtualScroller(
  document.getElementById('rep-list-container'),
  80, // altura de cada item
  (item, index) => createReportItem(item)
);

scroller.setItems(state.items);
```

**Impacto:**
- 🚀 **Render:** 10-100x más rápido
- 💾 **Memoria:** -95% uso de DOM
- ⚡ **Scroll:** Súper fluido

---

### 7. **Optimización de CSS**

#### Critical CSS Inline:
```html
<!-- Extraer CSS crítico above-the-fold -->
<head>
  <style>
    /* Critical CSS inline para primera pantalla */
    body { margin: 0; font-family: Inter, sans-serif; }
    .app-header { height: 60px; background: #fff; }
    /* ... solo estilos críticos ... */
  </style>
  
  <!-- CSS completo carga async -->
  <link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="styles.css"></noscript>
</head>
```

#### Eliminar CSS no usado:
```bash
# Usando PurgeCSS
npm install -D @fullhuman/postcss-purgecss

# postcss.config.js
module.exports = {
  plugins: [
    require('@fullhuman/postcss-purgecss')({
      content: ['./**/*.html', './**/*.js'],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
    })
  ]
}
```

---

### 8. **Service Worker para Cache Offline**

```javascript
// service-worker.js
const CACHE_NAME = 'sofia-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/core.js',
  '/router.js',
  '/assets/logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache first, network fallback
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Cache páginas visitadas
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Registrar en index.html
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('✅ Service Worker registrado'))
      .catch(err => console.error('❌ SW Error:', err));
  });
}
```

---

### 9. **Optimización de Imágenes**

#### Implementar formato WebP:
```html
<picture>
  <source srcset="assets/banner.webp" type="image/webp">
  <source srcset="assets/banner.jpg" type="image/jpeg">
  <img src="assets/banner.jpg" alt="Banner" loading="lazy">
</picture>
```

#### Script de conversión:
```bash
# Instalar herramientas
npm install -g sharp-cli

# Convertir todas las imágenes
for file in assets/*.{jpg,png}; do
  sharp -i "$file" -o "${file%.*}.webp" -f webp -q 85
done
```

---

### 10. **Prefetching de Módulos**

```javascript
// En router.js - Prefetch al hover
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    const route = item.dataset.route;
    if (route) {
      prefetchModule(route);
    }
  });
});

function prefetchModule(route) {
  const mod = routes.get(route);
  if (mod && !mod.prefetched) {
    // Prefetch del HTML
    fetch(mod.viewPath, { cache: 'force-cache' });
    
    // Prefetch del JS si existe
    if (mod.scriptPath) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = mod.scriptPath;
      document.head.appendChild(link);
    }
    
    mod.prefetched = true;
  }
}
```

---

## 📈 Resumen de Impacto Esperado

| Optimización | Mejora Esperada | Implementación |
|-------------|-----------------|----------------|
| **GZIP Compression** | -60-80% tamaño | Fácil |
| **Cache Headers** | 3-5x más rápido | Fácil |
| **Lazy Loading** | -50% carga inicial | Media |
| **Debouncing** | -90% requests | Fácil |
| **LocalStorage Cache** | -70% requests DB | Media |
| **Virtual Scrolling** | 10-100x render | Difícil |
| **Service Worker** | Funciona offline | Media |
| **WebP Images** | -30% tamaño imgs | Fácil |
| **Prefetching** | Carga instantánea | Fácil |
| **Critical CSS** | -2s First Paint | Media |

---

## 🎯 Plan de Implementación por Fases

### Fase 1 - Quick Wins (1-2 días)
1. ✅ Habilitar GZIP + Cache headers
2. ✅ Agregar debouncing a búsquedas
3. ✅ Preconnect a Supabase
4. ✅ Lazy loading de imágenes

**Impacto:** 50-70% mejora

### Fase 2 - Medium Impact (3-5 días)
5. ✅ Implementar LocalStorage cache
6. ✅ Prefetching de módulos
7. ✅ Convertir imágenes a WebP
8. ✅ Critical CSS inline

**Impacto adicional:** 20-30%

### Fase 3 - Advanced (1-2 semanas)
9. ✅ Service Worker completo
10. ✅ Virtual scrolling
11. ✅ Code splitting
12. ✅ HTTP/2 push

**Impacto adicional:** 10-20%

---

## 🔧 Instalación de Dependencias

```bash
# En WEB directory
npm init -y
npm install compression express
npm install -D @fullhuman/postcss-purgecss autoprefixer
```

---

## ✅ Checklist de Performance

- [ ] Compression GZIP habilitada
- [ ] Cache headers configurados
- [ ] Lazy loading de imágenes
- [ ] Debouncing en búsquedas
- [ ] LocalStorage cache
- [ ] Preconnect a APIs
- [ ] Prefetch de módulos
- [ ] Critical CSS inline
- [ ] Service Worker
- [ ] Imágenes WebP
- [ ] Virtual scrolling (listas grandes)
- [ ] Minificación de JS/CSS

---

## 📊 Herramientas de Medición

### Google Lighthouse
```bash
# Audit completo
lighthouse http://localhost:3000 --view
```

### WebPageTest
https://www.webpagetest.org/

### Chrome DevTools
- Network tab: Analizar tamaño y tiempo
- Performance tab: Profiling
- Coverage tab: CSS/JS no usado

---

## 🎓 Mejores Prácticas

1. **Measure First** - Usa Lighthouse antes y después
2. **Prioriza** - Quick wins primero
3. **Test Real** - Prueba en dispositivos reales
4. **Monitor** - Configura alertas de performance
5. **Iterate** - Mejora continua

---

**Objetivo Final:**
- ⚡ First Contentful Paint < 1.5s
- 🚀 Time to Interactive < 3.5s
- 💯 Lighthouse Score > 90
- 📱 Funciona offline

