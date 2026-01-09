// Debounce Utility - Optimiza búsquedas y filtros
// Uso: const debouncedFn = debounce(myFunction, 300);

window.debounce = function(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const context = this;
    const later = () => {
      clearTimeout(timeout);
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle Utility - Limita ejecución por tiempo
// Uso: const throttledFn = throttle(myFunction, 1000);

window.throttle = function(func, limit = 1000) {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

console.log('⚡ Performance utilities loaded');
