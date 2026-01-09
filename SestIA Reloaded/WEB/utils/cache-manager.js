// Cache Manager - LocalStorage con TTL
// Maneja cache de datos con tiempo de expiración

window.CacheManager = {
  TTL: {
    SHORT: 5 * 60 * 1000,      // 5 minutos
    MEDIUM: 30 * 60 * 1000,    // 30 minutos
    LONG: 24 * 60 * 60 * 1000  // 24 horas
  },
  
  /**
   * Guardar datos en cache
   * @param {string} key - Clave única
   * @param {*} data - Datos a guardar
   * @param {number} ttl - Tiempo de vida en ms
   */
  set(key, data, ttl = this.TTL.MEDIUM) {
    try {
      const item = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
      console.log(`[Cache] ✅ Guardado: ${key}`);
      return true;
    } catch (e) {
      console.error('[Cache] ❌ Error guardando:', e);
      // Si localStorage está lleno, limpiar cache antiguo
      if (e.name === 'QuotaExceededError') {
        this.cleanup();
        try {
          const item = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
          };
          localStorage.setItem(`cache_${key}`, JSON.stringify(item));
          return true;
        } catch (e2) {
          console.error('[Cache] ❌ Error después de limpieza:', e2);
        }
      }
      return false;
    }
  },
  
  /**
   * Obtener datos del cache
   * @param {string} key - Clave a buscar
   * @returns {*} - Datos o null si no existe/expiró
   */
  get(key) {
    try {
      const itemStr = localStorage.getItem(`cache_${key}`);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      const now = Date.now();
      
      // Verificar si expiró
      if (now - item.timestamp > item.ttl) {
        this.remove(key);
        console.log(`[Cache] ⏱️  Expirado: ${key}`);
        return null;
      }
      
      console.log(`[Cache] ✅ Hit: ${key}`);
      return item.data;
    } catch (e) {
      console.error('[Cache] ❌ Error leyendo:', e);
      this.remove(key);
      return null;
    }
  },
  
  /**
   * Eliminar un item del cache
   * @param {string} key - Clave a eliminar
   */
  remove(key) {
    localStorage.removeItem(`cache_${key}`);
    console.log(`[Cache] 🗑️  Eliminado: ${key}`);
  },
  
  /**
   * Limpiar todo el cache
   */
  clear() {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
        count++;
      }
    });
    console.log(`[Cache] 🧹 Limpiado ${count} items`);
  },
  
  /**
   * Limpiar items expirados
   */
  cleanup() {
    const keys = Object.keys(localStorage);
    let cleaned = 0;
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        try {
          const itemStr = localStorage.getItem(key);
          const item = JSON.parse(itemStr);
          const now = Date.now();
          
          if (now - item.timestamp > item.ttl) {
            localStorage.removeItem(key);
            cleaned++;
          }
        } catch (e) {
          // Si hay error parseando, eliminar
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    });
    console.log(`[Cache] 🧹 Limpieza automática: ${cleaned} items eliminados`);
  },
  
  /**
   * Obtener estadísticas del cache
   */
  stats() {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    let totalSize = 0;
    let valid = 0;
    let expired = 0;
    
    cacheKeys.forEach(key => {
      const itemStr = localStorage.getItem(key);
      totalSize += itemStr.length;
      
      try {
        const item = JSON.parse(itemStr);
        const now = Date.now();
        if (now - item.timestamp > item.ttl) {
          expired++;
        } else {
          valid++;
        }
      } catch (e) {
        expired++;
      }
    });
    
    const stats = {
      total: cacheKeys.length,
      valid: valid,
      expired: expired,
      size: (totalSize / 1024).toFixed(2) + ' KB',
      maxSize: '5 MB (aprox.)'
    };
    
    console.table(stats);
    return stats;
  }
};

// Limpieza automática al cargar
window.CacheManager.cleanup();

console.log('💾 Cache Manager loaded');
