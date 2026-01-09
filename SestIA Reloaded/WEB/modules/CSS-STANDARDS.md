# Estándares CSS para Módulos Sofia

## Problema Resuelto

Este documento establece las reglas para evitar **colisiones de CSS** entre módulos y la página principal.

## ⚠️ REGLAS OBLIGATORIAS

### 1. **Namespace Único por Módulo**

Cada módulo **DEBE** tener un contenedor principal con ID único que sirva como namespace:

```html
<!-- ✅ CORRECTO -->
<div id="mi-modulo-module">
  <h1>Título</h1>
  <button class="btn">Acción</button>
</div>

<!-- ❌ INCORRECTO -->
<div class="container">
  <h1>Título</h1>
  <button class="btn">Acción</button>
</div>
```

**Convención de nombres:**
- ID del contenedor: `{nombre-modulo}-module`
- Ejemplos: `#users-module`, `#contacts-module`, `#livechat-module`

### 2. **Todos los Selectores Deben Usar el Namespace**

**NUNCA** usar selectores globales. **SIEMPRE** prefijar con el ID del módulo:

```css
/* ✅ CORRECTO - Estilos encapsulados */
#mi-modulo-module .btn {
  background: blue;
  padding: 10px;
}

#mi-modulo-module .header {
  font-size: 24px;
}

#mi-modulo-module input[type="text"] {
  border: 1px solid #ccc;
}

/* ❌ INCORRECTO - Afecta globalmente */
.btn {
  background: blue;
}

.header {
  font-size: 24px;
}

input[type="text"] {
  border: 1px solid #ccc;
}
```

### 3. **Variables CSS con Namespace (Opcional pero Recomendado)**

Para variables específicas del módulo:

```css
#mi-modulo-module {
  --mi-modulo-primary: #3b82f6;
  --mi-modulo-spacing: 1rem;
  --mi-modulo-border-radius: 8px;
}

#mi-modulo-module .card {
  background: var(--mi-modulo-primary);
  padding: var(--mi-modulo-spacing);
  border-radius: var(--mi-modulo-border-radius);
}
```

### 4. **Uso de Variables Globales**

Puedes usar variables globales definidas en `styles.css` sin preocupaciones:

```css
/* Variables globales disponibles (definidas en WEB/styles.css) */
#mi-modulo-module .panel {
  background: var(--panel);        /* ✅ OK */
  border: 1px solid var(--border); /* ✅ OK */
  color: var(--text);              /* ✅ OK */
}
```

**Variables globales disponibles:**
- Colores: `--bg`, `--panel`, `--panel-2`, `--text`, `--muted`, `--brand`, `--danger`, `--border`
- Sombras: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

### 5. **Modales y Elementos Fuera del Módulo**

Si tu módulo crea modales que están **fuera** del contenedor principal:

```html
<!-- Módulo -->
<div id="mi-modulo-module">
  ...
</div>

<!-- Modal (fuera del namespace) -->
<dialog id="mi-modulo-modal">
  ...
</dialog>
```

Debes usar un ID específico y selectores completos:

```css
/* ✅ Estilos para el modal */
#mi-modulo-modal {
  border: none;
  border-radius: 16px;
  padding: 0;
}

#mi-modulo-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

#mi-modulo-modal .modal-body {
  padding: 1.5rem;
}
```

## 📋 Checklist de Desarrollo

Antes de considerar tu módulo completo, verifica:

- [ ] El archivo `view.html` tiene un contenedor principal con ID `#{nombre-modulo}-module`
- [ ] Todos los selectores en `styles.css` comienzan con `#{nombre-modulo}-module`
- [ ] No hay selectores de etiqueta sin namespace (ej: `h1`, `button`, `input`)
- [ ] Las clases utilitarias globales (`.hidden`, `.btn`) no se redefinen
- [ ] Los modales/dialogs tienen IDs únicos con selectores específicos
- [ ] Has probado el módulo junto con otros módulos activos

## 🎯 Ejemplo Completo

### view.html
```html
<div id="ejemplo-module" class="module-container">
  <header class="ejemplo-header">
    <h2 class="module-title">Mi Módulo</h2>
    <button class="btn-primary">Nueva Acción</button>
  </header>

  <div class="ejemplo-content">
    <div class="card">
      <h3>Título de Card</h3>
      <p>Contenido...</p>
    </div>
  </div>
</div>
```

### styles.css
```css
/* Namespace principal */
#ejemplo-module {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1rem;
}

/* Header del módulo */
#ejemplo-module .ejemplo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

#ejemplo-module .module-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

/* Botones específicos del módulo */
#ejemplo-module .btn-primary {
  padding: 0.75rem 1.5rem;
  background: var(--brand);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

#ejemplo-module .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Cards */
#ejemplo-module .card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

#ejemplo-module .card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--text);
}

#ejemplo-module .card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 768px) {
  #ejemplo-module {
    padding: 1rem;
  }

  #ejemplo-module .ejemplo-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
}
```

## 🚫 Antipatrones Comunes

### ❌ NO hacer esto:

```css
/* Selector global - afectará TODOS los h1 */
h1 {
  font-size: 2rem;
}

/* Clase genérica - chocará con otros módulos */
.card {
  background: white;
}

/* Input sin namespace - afectará todos los inputs */
input {
  padding: 10px;
}

/* !important innecesario */
.btn {
  color: red !important;
}
```

### ✅ SÍ hacer esto:

```css
/* Selector con namespace - solo afecta al módulo */
#ejemplo-module h1 {
  font-size: 2rem;
}

/* Clase con namespace */
#ejemplo-module .card {
  background: white;
}

/* Input con namespace */
#ejemplo-module input {
  padding: 10px;
}

/* Sin !important, usando especificidad adecuada */
#ejemplo-module .btn {
  color: red;
}
```

## 🔧 Migración de Módulos Existentes

Si tienes un módulo antiguo sin namespace:

1. Agrega el ID al contenedor en `view.html`:
   ```html
   <div id="tu-modulo-module">
   ```

2. Buscar y reemplazar en `styles.css`:
   - Busca: `^\.` (inicio de línea + punto)
   - Reemplaza: `#tu-modulo-module .`

3. Verifica manualmente:
   - Selectores de etiquetas: `h1`, `p`, `button`, etc.
   - Pseudo-clases: `:hover`, `:focus`, etc.
   - Media queries deben incluir el namespace dentro

## 📚 Recursos

- **Variables globales:** Ver `WEB/styles.css` (líneas 1-16)
- **Componentes UI globales:** Ver `WEB/ui.css`
- **Ejemplo completo:** Ver `WEB/modules/contacts/` o `WEB/modules/livechat/`

## 🆘 Soporte

Si encuentras conflictos de estilos:

1. Verifica que todos tus selectores tengan el namespace
2. Usa las DevTools del navegador para inspeccionar qué estilos se están aplicando
3. Busca selectores con mayor especificidad en otros archivos
4. Considera usar el formato `#tu-modulo-module #elemento-id` para IDs dentro del módulo

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0
