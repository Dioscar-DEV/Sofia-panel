# Guía de Migración CSS - Módulos Restantes

## Estado de Migración

### ✅ Módulos Completados (Siguen el estándar)
- **contacts** - `#contacts-module` ✓
- **livechat** - `#livechat-module` ✓
- **home** - `#home-module` ✓ (actualizado)
- **template** - `#template-module` ✓ (actualizado)

### ⚠️ Módulos Pendientes de Migración

#### 1. **users** - PARCIALMENTE MIGRADO
**Estado:** HTML actualizado, CSS requiere actualización masiva

**Acción requerida:**
```bash
# El archivo view.html ya tiene el ID correcto:
<section id="users-module" class="users-management">

# Pero styles.css (1312 líneas) necesita que TODOS los selectores se actualicen
```

**Solución rápida (Buscar y Reemplazar):**

1. Abrir `WEB/modules/users/styles.css`
2. Buscar y reemplazar:
   - Buscar: `^\.(management-header|header-title-area|page-title|tabs-|panel-|form-|btn-|user-|permission-|modal-|stat-)`
   - Reemplazar por: `#users-module .$1`

3. Revisar manualmente selectores de etiquetas como:
   - `.users-management {` → `#users-module.users-management {`
   - Cualquier selector que no empiece con clase

**Archivo:** [WEB/modules/users/styles.css](../users/styles.css)

---

#### 2. **indice** - NO MIGRADO
**Estado:** Requiere migración completa

**Archivo view.html actual:**
```html
<section class="indice-layout">
```

**Actualización necesaria:**
```html
<section id="indice-module" class="indice-layout">
```

**Archivo styles.css:**
- Archivo: `WEB/modules/indice/styles.css`
- Todos los selectores que comienzan con `.indice-` deben actualizarse a `#indice-module .indice-`

**Pasos:**

1. **Actualizar view.html:**
   ```html
   <section id="indice-module" class="indice-layout">
   ```

2. **Actualizar styles.css:**
   - Buscar: `^\.indice-`
   - Reemplazar: `#indice-module .indice-`

3. **Actualizar modales (si aplica):**
   - Los modales fuera del contenedor necesitan ID específico:
   ```css
   #indice-modal { ... }
   #indice-modal .modal-header { ... }
   ```

---

## Herramienta de Migración Automática

Para facilitar la migración, puedes usar este script de Node.js:

```javascript
// migrate-module.js
const fs = require('fs');
const path = require('path');

const moduleName = process.argv[2]; // ej: 'users', 'indice'
if (!moduleName) {
  console.error('Uso: node migrate-module.js <nombre-modulo>');
  process.exit(1);
}

const moduleId = `${moduleName}-module`;
const cssFile = path.join(__dirname, 'WEB', 'modules', moduleName, 'styles.css');

// Leer CSS
let css = fs.readFileSync(cssFile, 'utf8');

// Regex para clases que probablemente pertenecen al módulo
const classRegex = new RegExp(`^\\.(${moduleName}[\\w-]*)`, 'gm');

// Reemplazar
css = css.replace(classRegex, `#${moduleId} .$1`);

// Guardar backup
fs.writeFileSync(cssFile + '.backup', css);

// Guardar nuevo archivo
fs.writeFileSync(cssFile, css);

console.log(`✅ Módulo '${moduleName}' migrado.`);
console.log(`   Backup guardado en: ${cssFile}.backup`);
console.log(`\n⚠️  IMPORTANTE: Revisa manualmente el archivo para:`);
console.log(`   1. Selectores de etiquetas (h1, p, button, etc.)`);
console.log(`   2. Modales que están fuera del contenedor principal`);
console.log(`   3. Selectores compuestos que necesiten ajustes`);
```

**Uso:**
```bash
node migrate-module.js indice
node migrate-module.js users
```

---

## Verificación Post-Migración

Después de migrar un módulo, verifica:

### 1. **Checklist Técnico**
- [ ] El archivo `view.html` tiene `id="{modulo}-module"`
- [ ] Todos los selectores CSS comienzan con `#{modulo}-module`
- [ ] No hay selectores globales sin namespace (`.btn`, `h1`, `input`)
- [ ] Los modales tienen IDs específicos si están fuera del contenedor

### 2. **Prueba Visual**
1. Abre la aplicación
2. Navega al módulo migrado
3. Navega a otro módulo (ej: home, contacts)
4. Regresa al módulo migrado
5. Verifica que los estilos se mantienen correctos

### 3. **Prueba de Colisión**
1. Abre DevTools (F12)
2. En el módulo migrado, inspecciona elementos
3. Verifica que los estilos aplicados vengan del archivo del módulo
4. No debe haber estilos de `styles.css` global afectando al módulo

---

## Problemas Comunes

### Problema 1: Estilos no se aplican después de migrar

**Causa:** El selector CSS es demasiado específico o tiene un error de sintaxis.

**Solución:**
```css
/* ❌ INCORRECTO */
#users-module .users-management .btn {
  /* Si .users-management es el mismo elemento que #users-module */
}

/* ✅ CORRECTO */
#users-module.users-management .btn {
  /* Combinador de clase e ID en el mismo elemento */
}
```

### Problema 2: Modales no funcionan

**Causa:** Los modales están fuera del contenedor principal y no tienen namespace.

**Solución:**
```html
<!-- Módulo -->
<div id="mi-modulo-module">...</div>

<!-- Modal fuera del módulo -->
<dialog id="mi-modulo-modal">...</dialog>
```

```css
/* CSS del modal */
#mi-modulo-modal {
  /* estilos del modal */
}
#mi-modulo-modal .modal-content {
  /* estilos internos */
}
```

### Problema 3: Selectores de pseudo-elementos no funcionan

**Causa:** Olvidaste agregar el namespace antes del pseudo-elemento.

**Solución:**
```css
/* ❌ INCORRECTO */
.btn::before {
  content: '→';
}

/* ✅ CORRECTO */
#mi-modulo-module .btn::before {
  content: '→';
}
```

---

## Prioridades de Migración

Recomendamos migrar en este orden:

1. **ALTA PRIORIDAD: indice** (módulo complejo, alto riesgo de colisiones)
2. **MEDIA PRIORIDAD: users** (ya tiene el ID, solo falta CSS)
3. **BAJA PRIORIDAD:** Otros módulos personalizados que puedas tener

---

## Soporte

Si encuentras problemas durante la migración:

1. Consulta [CSS-STANDARDS.md](CSS-STANDARDS.md) para las reglas completas
2. Revisa los módulos ya migrados como referencia:
   - `modules/contacts/` - Ejemplo completo con modal
   - `modules/livechat/` - Ejemplo con estados dinámicos
   - `modules/template/` - Plantilla básica actualizada

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0
