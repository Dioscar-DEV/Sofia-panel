const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Habilitar compresión GZIP (instalar: npm install compression)
// Si no está instalado, comentar estas líneas
try {
  const compression = require('compression');
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  console.log('⚡ Compresión GZIP: Activa');
} catch (e) {
  console.log('⚠️  Compresión GZIP: No disponible (instalar con: npm install compression)');
}

// ✅ Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ✅ Cache headers optimizados para assets estáticos
app.use(express.static(__dirname, {
  maxAge: '1d', // Default 1 día
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

// Middleware para manejar rutas SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Accede en: http://localhost:${PORT}`);
  console.log(`💾 Cache Headers: Configurados`);
  console.log(`🔒 Security Headers: Activos`);
});
