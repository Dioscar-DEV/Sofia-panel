# 📊 Análisis Completo del Proyecto SestIA Reloaded

**Fecha de Análisis:** Noviembre 2025  
**Versión del Proyecto:** 2.0  
**Tipo de Sistema:** Aplicación Web Modular con Autenticación y Gestión de Contenido

---

## 🎯 Resumen Ejecutivo

**SestIA Reloaded** es una aplicación web modular construida con tecnologías web nativas (HTML5, CSS3, JavaScript puro) que utiliza Supabase como backend completo. El sistema está diseñado para ser completamente configurable desde la base de datos, permitiendo cambiar colores, logos, textos y toda la configuración visual sin necesidad de modificar código.

### Analogía del Sistema

Imagina un edificio inteligente donde cada habitación es un módulo independiente. El edificio tiene:
- **Un sistema de seguridad centralizado** (autenticación): Solo las personas con llaves correctas pueden entrar
- **Un decorador automático** (sistema de temas): Las paredes y colores cambian según lo que se configure en una pantalla central
- **Habitaciones modulares** (módulos): Cada habitación puede agregarse o quitarse sin afectar las demás
- **Un conserje inteligente** (router): Decide qué habitación mostrar según quién está visitando

---

## 🏗️ Arquitectura General

### Tipo de Aplicación

**Single Page Application (SPA)** con arquitectura modular basada en hash routing.

### Stack Tecnológico

```
Frontend:
├── HTML5 (Semántico y accesible)
├── CSS3 (Variables CSS para temas dinámicos)
├── JavaScript Vanilla (ES6+, sin frameworks)
└── Supabase JS SDK v2

Backend:
├── Supabase (PostgreSQL + Auth + Realtime)
├── Edge Functions (TypeScript/Deno)
└── N8N (Automatización de workflows)
```

### Flujo de Carga de la Aplicación

```
1. index.html carga
2. Scripts base se cargan en orden:
   ├── config.js (credenciales Supabase)
   ├── theme.js (sistema de temas)
   ├── core.js (núcleo de la aplicación)
   ├── router.js (enrutamiento)
   ├── ui.js (utilidades de UI)
   ├── loader.js (cargador de módulos)
   └── app-init.js (inicialización principal)

3. Loader carga manifest.json
4. Loader registra rutas en Router
5. Router detecta hash actual
6. Router carga módulo correspondiente
7. Módulo se inicializa y renderiza
```

---

## 📁 Estructura del Proyecto

```
SestIA Reloaded/
│
├── WEB/                          # Frontend principal
│   ├── index.html                # Punto de entrada HTML
│   ├── config.js                 # Configuración de Supabase
│   ├── core.js                   # Núcleo: Auth, Profile, Permissions
│   ├── router.js                 # Sistema de enrutamiento
│   ├── theme.js                  # Sistema de temas dinámicos
│   ├── ui.js                     # Utilidades UI (toasts, modales)
│   ├── app-init.js               # Inicialización principal (1349 líneas)
│   ├── styles.css                # Estilos globales
│   ├── ui.css                    # Estilos de componentes UI
│   │
│   ├── assets/                    # Recursos estáticos
│   │   ├── logo.svg              # Logo por defecto
│   │   ├── banner.svg            # Banner por defecto
│   │   └── fonts/                # Fuentes Inter (300-700)
│   │
│   └── modules/                   # Módulos de la aplicación
│       ├── manifest.json         # Configuración de módulos
│       ├── loader.js             # Cargador dinámico de módulos
│       │
│       ├── home/                 # Dashboard principal
│       │   ├── init.js
│       │   ├── view.html
│       │   └── styles.css
│       │
│       ├── livechat/             # Chat en tiempo real
│       │   ├── init.js           # Módulo más complejo
│       │   ├── view.html
│       │   └── styles.css
│       │
│       ├── indice/               # Gestión de contenido
│       │   ├── init.js
│       │   ├── view.html
│       │   └── styles.css
│       │
│       ├── users/                # Gestión de usuarios
│       │   ├── init.js
│       │   ├── view.html
│       │   └── styles.css
│       │
│       ├── invite/               # Sistema de invitaciones
│       │   ├── init.js
│       │   ├── view.html
│       │   └── styles.css
│       │
│       └── template/             # Plantilla para nuevos módulos
│           ├── init.js
│           ├── view.html
│           └── styles.css
│
├── SUPABASE/                     # Configuración backend
│   ├── sql definitivo.sql       # Script SQL completo
│   ├── sql definitivo.sql.md    # Documentación SQL
│   ├── Credenciales.txt         # Credenciales (⚠️ no versionar)
│   ├── deploy-functions.js      # Script de despliegue
│   └── supabase/
│       ├── config.toml          # Configuración Supabase CLI
│       └── functions/
│           └── invite-user/      # Edge Function para invitaciones
│               └── index.ts
│
├── N8N/                          # Automatización (pendiente análisis)
│
└── WEB DEPLOYMENT/               # Scripts de despliegue
    ├── deploy.ps1               # Script PowerShell para deploy
    └── backup.ps1               # Script de respaldo
```

---

## 🧩 Componentes Principales

### 1. **core.js** - El Corazón del Sistema

**Función:** Proporciona el núcleo compartido de la aplicación: autenticación, gestión de sesiones, perfiles y permisos.

**Analogía:** Es como el sistema operativo del edificio. Todas las habitaciones (módulos) dependen de él para saber quién es el usuario y qué puede hacer.

**Características Clave:**
- **Autenticación Supabase:** `signIn()`, `signOut()`, `restoreSession()`
- **Gestión de Perfiles:** Carga perfil del usuario desde `profiles` o RPC
- **Sistema de Permisos:** `hasPerm()`, `can()`, carga permisos desde múltiples fuentes
- **Tokens Semánticos:** `applyTokensToDOM()` para inyección de datos en HTML
- **Tema:** Acceso a configuración de tema desde `window.__THEME__`

**Flujo de Autenticación:**
```javascript
1. Usuario ingresa credenciales en app-init.js
2. app-init.js llama App.signIn(email, password)
3. core.js delega a supabase.auth.signInWithPassword()
4. Supabase valida y retorna sesión
5. app-init.js guarda sesión en App.session
6. app-init.js carga perfil con App.loadProfile()
7. app-init.js carga permisos con App.loadPermissions()
8. Router detecta sesión y muestra aplicación
```

---

### 2. **router.js** - El Navegador Inteligente

**Función:** Maneja la navegación basada en hash (`#/ruta`) y carga dinámica de módulos.

**Analogía:** Es el conserje del edificio que sabe en qué habitación está cada persona y qué habitaciones puede visitar.

**Características:**
- **Hash Routing:** Usa `location.hash` para navegación (ej: `#/livechat`)
- **Guards de Seguridad:** Verifica roles y permisos antes de cargar módulos
- **Carga Dinámica:** Carga HTML y ejecuta `init()` del módulo
- **Rutas Públicas:** Soporta rutas públicas (ej: `#/invite` para invitaciones)
- **Parsing Inteligente:** Maneja rutas complejas como `invite#access_token=...`

**Flujo de Navegación:**
```javascript
1. Usuario navega o cambia hash
2. window.addEventListener('hashchange') detecta cambio
3. Router.onRouteChange() se ejecuta
4. Router obtiene ruta del hash
5. Router verifica autenticación (si ruta no es pública)
6. Router verifica permisos/roles del módulo
7. Router busca módulo en Map de rutas
8. Router carga view.html del módulo
9. Router ejecuta mod.init() del módulo
10. Módulo renderiza su contenido
```

---

### 3. **theme.js** - El Decorador Automático

**Función:** Sistema de temas completamente dinámico que lee desde Supabase y aplica estilos en tiempo real.

**Analogía:** Es como un decorador de interiores que puede cambiar todos los colores, logos y textos del edificio desde una pantalla central.

**Características:**
- **Carga desde Supabase:** Lee configuración de tabla `frontconfig` con key `theme`
- **Variables CSS:** Aplica colores como variables CSS (`--brand`, `--accent`, etc.)
- **Actualización DOM:** Actualiza elementos con `data-brand-name`, `data-logo-src`, etc.
- **Fallback Inteligente:** Si Supabase falla, usa tema por defecto
- **API Pública:** `window.reloadTheme()`, `window.updateTheme()`

**Estructura del Tema:**
```javascript
{
  brandName: "SestIA",
  brandShort: "SestIA",
  logoUrl: "assets/logo.svg",
  bannerUrl: "assets/banner.svg",
  bannerText: "Sistema Modular de Gestión",
  footer: {
    text: "© 2025 SestIA",
    links: [...]
  },
  colors: {
    brand: "#3b82f6",
    accent: "#1e40af",
    success: "#10b981",
    // ... más colores
  }
}
```

---

### 4. **modules/loader.js** - El Gestor de Módulos

**Función:** Carga dinámica de módulos desde `manifest.json` y registro en el router.

**Analogía:** Es el sistema de construcción modular que puede agregar nuevas habitaciones al edificio sin reconstruirlo.

**Características:**
- **Carga de Manifest:** Lee `modules/manifest.json`
- **Validación de Seguridad:** Valida rutas de scripts/views con `isSafePath()`
- **Carga de Scripts:** Carga scripts de módulos una sola vez (evita duplicados)
- **Registro de Rutas:** Registra cada módulo en Router
- **Navegación Dinámica:** Construye menú de navegación desde módulos visibles

**Estructura de Manifest:**
```json
{
  "modules": [
    {
      "key": "home",
      "moduleName": "HomeModule",
      "script": "modules/home/init.js",
      "view": "modules/home/view.html",
      "label": "Inicio",
      "roles": [],
      "perms": ["home.view"],
      "public": false,
      "nav": { "group": "dropdown", "order": 10, "show": true }
    }
  ]
}
```

---

### 5. **app-init.js** - El Inicializador Principal

**Función:** Inicialización completa de la aplicación, manejo de formularios, modales y lógica de autenticación compleja.

**Características Principales:**
- **Formulario de Login:** Validación en tiempo real, manejo de errores
- **Recuperación de Contraseña:** Modal integrado, envío de emails
- **Cambio de Contraseña:** Modal para enlaces de recuperación
- **Sistema de Invitaciones:** Manejo de tokens de invitación
- **Navegación:** Actualización de navegación activa, dropdown funcional
- **Modales Legales:** Términos y condiciones, política de privacidad
- **Footer:** Reloj en tiempo real, enlaces configurables

**Lógica Compleja Detectada:**
1. **Manejo de Enlaces de Recuperación:** Detecta tokens en hash/query params
2. **Cambio Obligatorio de Contraseña:** Para usuarios con `must_change_password`
3. **Invitaciones:** Procesamiento de tokens de invitación con `setSession()`

---

## 🔐 Sistema de Autenticación y Autorización

### Flujo de Autenticación

```
1. Usuario ingresa email/password
2. Validación en tiempo real (email válido, password mínimo 6 caracteres)
3. App.signIn(email, password) → Supabase Auth
4. Supabase valida y retorna sesión
5. Verificar si usuario necesita cambiar contraseña
6. Cargar perfil desde profiles o RPC
7. Cargar permisos desde role_permissions o user_permissions
8. Actualizar UI (email, rol en header)
9. Renderizar navegación según permisos
10. Redirigir a módulo por defecto (#/livechat o #/home)
```

### Sistema de Roles

**Roles Predefinidos:**
- `user`: Usuario básico (solo lectura)
- `admin`: Administrador (gestión completa)
- `superadmin`: Super administrador (acceso total)

### Sistema de Permisos

**⚠️ PRINCIPIO FUNDAMENTAL**: El sistema NO filtra por roles, SOLO por permisos.

**Secuencia de Verificación**:
1. ¿Usuario autenticado?
2. ¿El rol del usuario tiene el permiso X? (role_permissions)
3. ¿Si no, el usuario específico tiene el permiso X? (user_permissions)

**Resultado**: TRUE o FALSE si el permiso existe para:
- El rol del usuario (desde `role_permissions`), O
- El permiso específico asignado al usuario (desde `user_permissions`)

**Estructura de Permisos (Granulares):**
```
Permisos por Módulo:
├── home.view
├── users.view, users.manage, users.invite, users.create, users.edit, users.delete, users.permissions
├── indice.view, indice.manage, indice.create, indice.edit, indice.delete
└── invitations.view, invitations.manage, invitations.cancel
```

**Verificación:**
- **Por Permiso:** `App.hasPerm('users.edit')` - Verifica si tiene permiso específico
- **Múltiples Permisos:** `App.hasPerm(['users.view', 'users.edit'])` (todos requeridos)
- **NOTA:** `App.can()` está disponible para compatibilidad pero se recomienda usar `hasPerm()` con permisos específicos

**Origen de Permisos:**
1. **RPC:** `get_permissions_by_user_id()` - Calcula UNION de permisos del rol + permisos específicos
2. **Fallback:** `get_my_permissions()` - Usa `auth.uid()` directamente
3. **Último Recurso:** Lectura directa de `user_permissions`

**Función Helper**: `current_user_has_permission(perm_key)` - Usada en políticas RLS para verificar permisos

---

## 🗄️ Base de Datos (Supabase)

### Esquema Principal

**Tabla `frontconfig`:**
- Almacena configuración visual (`theme`)
- JSONB para máxima flexibilidad

**Tabla `profiles`:**
- Perfiles de usuarios vinculados a `auth.users`
- Campos: `user_id`, `email`, `role`, `name`

**Tabla `roles`:**
- Definición de roles del sistema

**Tabla `permissions`:**
- Permisos disponibles: `perm_key`, `name`, `description`, `module`

**Tabla `role_permissions`:**
- Asignación de permisos a roles (relación muchos a muchos)

**Tabla `user_permissions`:**
- Permisos específicos por usuario (sobrescribe roles)

**Tabla `invitations`:**
- Invitaciones pendientes con tokens

**Esquema `instancias`:**
- Tablas específicas por módulo (ej: `instancias.INDICE`, `instancias.INDICE_LOG`)
 - Agente IA (N8N): `agent_config`, `agent_vars`, `blacklist`, `input_channels`, `agent_contact_list`, `agent_surveys`, `agent_task_list`, `agent_task_assign`, vista `v_tasks_summary` y RPC `instancias.complete_or_report_agent_task`

**Esquema `kpidata`:**
- Métricas y contenidos auxiliares del agente IA.
- Tablas: `kpidata.conversations`, `kpidata.messages`, `kpidata.multimedia_incoming`, `kpidata.multimedia_processing`, `kpidata.iainterna`, `kpidata.tools`.
- Seguridad: RLS habilitado en todas; acceso previsto vía `service_role` (N8N/backend) con grants a nivel de esquema/objetos.

### Funciones RPC Importantes

```sql
- get_profile_by_user_id(p_user_id UUID)
- get_permissions_by_user_id(p_user_id UUID)
- get_my_permissions()
- indice_list()
- indice_upsert(...)
- indice_delete(...)
- accept_invitation_native(p_email TEXT)
- cancel_invitation_complete(...)
```

---

## 🎨 Sistema de Temas Dinámico

### Cómo Funciona

1. **Inicialización:**
   - `theme.js` espera a que Supabase esté disponible (hasta 5 segundos)
   - Carga tema desde `frontconfig` con key `theme`
   - Si falla, usa `DEFAULT_THEME`

2. **Aplicación:**
   - Convierte colores hex a RGB para variables CSS
   - Aplica variables CSS al `:root`
   - Actualiza elementos DOM con `data-*` attributes
   - Actualiza `document.title` y meta description

3. **Actualización Dinámica:**
   - `window.reloadTheme()`: Recarga desde Supabase
   - `window.updateTheme(newTheme)`: Actualiza en Supabase y recarga

### Variables CSS Generadas

```css
:root {
  --brand: #3b82f6;
  --brand-rgb: 59, 130, 246;
  --brand-light: #60a5fa;
  --accent: #1e40af;
  --success: #10b981;
  --danger: #dc2626;
  --warning: #f59e0b;
  --info: #0ea5e9;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --banner-image: url('assets/banner.svg');
}
```

---

## 📦 Módulos Disponibles

### 1. **home** - Dashboard Principal
- **Función:** Muestra tarjetas de módulos disponibles
- **Permisos:** `home.view`
- **Características:** Renderiza dinámicamente desde `manifest.json`

### 2. **livechat** - Chat en Tiempo Real
- **Función:** Sistema de chat con contactos y mensajes
- **Características:**
  - Búsqueda de conversaciones
  - Filtrado por agente
  - Paginación inteligente de mensajes
  - Scroll automático
  - Indicador de mensajes nuevos
  - Suscripción en tiempo real con Supabase Realtime

### 3. **indice** - Gestión de Contenido
- **Función:** CRUD de contenido con etiquetas y colores
- **Permisos:** `indice.view`, `indice.manage`
- **Características:** Sistema de etiquetas, colores personalizables, logs de cambios

### 4. **users** - Gestión de Usuarios
- **Función:** CRUD de usuarios, roles y permisos
- **Permisos:** `users.manage`
- **Características:** Asignación de roles, permisos personalizados

### 5. **invite** - Sistema de Invitaciones
- **Función:** Invitaciones por email con tokens
- **Ruta Pública:** Sí (no requiere autenticación)
- **Características:**
  - Procesamiento de tokens de invitación
  - Modal de aceptación con creación de contraseña
  - Integración con Edge Function `invite-user`

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Validación de Rutas:**
   - `isSafePath()` valida rutas de módulos
   - Solo permite rutas dentro de `modules/`
   - Bloquea `..`, `http://`, `https://`

2. **Guards de Router:**
   - Verifica autenticación antes de cargar módulos privados
   - Verifica roles y permisos
   - Muestra mensaje de "Acceso restringido" si no tiene permisos

3. **RLS (Row Level Security):**
   - Políticas en Supabase para acceso a datos
   - Usuarios solo ven sus propios datos o datos según permisos

4. **Validación de Formularios:**
   - Validación en tiempo real
   - Validación en servidor (Supabase)
   - Sanitización de inputs

### Áreas de Mejora

1. **CSP (Content Security Policy):** No implementado
2. **Rate Limiting:** Depende de Supabase
3. **CORS:** Configurado en Supabase, pero podría mejorarse
4. **Tokens en URL:** Los tokens de invitación están en la URL (considerar POST)

5. **Apertura controlada del Agente:** Actualmente el acceso a tablas del agente se piensa solo por backend (`service_role`). Si se desea exponer funcionalidades al frontend, será necesario diseñar políticas RLS específicas y/o endpoints dedicados.

---

## 🚀 Despliegue

### Opciones de Despliegue

1. **Hosting Estático:**
   - Netlify, Vercel, GitHub Pages
   - Solo requiere subir carpeta `WEB/`
   - Configurar credenciales en `config.js`

2. **Servidor Web Tradicional:**
   - Apache, Nginx
   - Servir archivos estáticos
   - Configurar CORS si es necesario

3. **Desarrollo Local:**
   - Live Server (extensión VS Code)
   - Python `http.server`
   - Node.js `http-server`

### Scripts de Despliegue

- **`deploy.ps1`:** Script PowerShell para deploy automatizado
- **`backup.ps1`:** Script de respaldo

---

## 📊 Métricas y Estadísticas

### Complejidad del Código

- **app-init.js:** 1349 líneas (archivo más grande)
- **core.js:** 213 líneas
- **router.js:** 138 líneas
- **theme.js:** 267 líneas
- **loader.js:** 161 líneas

### Módulos

- **Total de Módulos:** 5 activos + 1 template
- **Módulos Públicos:** 1 (invite)
- **Módulos Privados:** 4

---

## ⚠️ Puntos de Atención

### 1. **app-init.js Demasiado Grande**

**Problema:** 1349 líneas en un solo archivo dificulta mantenimiento.

**Recomendación:**
```javascript
// Dividir en módulos:
app-init.js          (200 líneas - orquestación)
auth-handler.js      (400 líneas - login/logout)
password-handler.js  (300 líneas - recuperación)
invitation-handler.js (200 líneas - invitaciones)
navigation-handler.js (150 líneas - navegación)
modal-handler.js     (100 líneas - modales)
```

### 2. **Credenciales Expuestas**

**Problema:** `config.js` contiene credenciales de Supabase en texto plano.

**Recomendación:**
- Mover a variables de entorno
- Usar archivo `.env` (no versionar)
- Usar servidor proxy para ocultar anon key

### 3. **Manejo de Tokens en URL**

**Problema:** Tokens de recuperación/invitación están en la URL.

**Recomendación:**
- Limpiar URL después de procesar
- Considerar POST para tokens sensibles
- Implementar expiración más corta

### 4. **Falta de Manejo de Errores Global**

**Problema:** Errores se manejan caso por caso, sin handler global.

**Recomendación:**
```javascript
window.addEventListener('error', (event) => {
  console.error('Error global:', event.error);
  UI.toast('Ha ocurrido un error inesperado', 'danger');
});
```

### 5. **Falta de Tests**

**Problema:** No hay tests unitarios ni de integración.

**Recomendación:**
- Implementar tests con Jest o Vitest
- Tests para funciones críticas (auth, permisos)
- Tests E2E con Playwright

---

## 🎯 Recomendaciones de Mejora

### Corto Plazo

1. **Refactorizar app-init.js** en módulos más pequeños
2. **Mover credenciales** a variables de entorno
3. **Agregar manejo de errores global**
4. **Documentar funciones complejas** (especialmente manejo de tokens)

### Mediano Plazo

1. **Implementar tests** (unitarios y E2E)
2. **Agregar CSP headers**
3. **Optimizar carga de módulos** (lazy loading)
4. **Implementar caché inteligente** para temas

### Largo Plazo

1. **Migrar a TypeScript** para type safety
2. **Implementar Service Workers** para PWA
3. **Agregar internacionalización (i18n)**
4. **Optimizar bundle size** (aunque es vanilla JS)

---

## 📝 Conclusión

**SestIA Reloaded** es un proyecto bien estructurado con arquitectura modular sólida. La decisión de usar JavaScript vanilla sin frameworks modernos es válida para mantener control total y simplicidad, aunque sacrifica algunas herramientas de desarrollo modernas.

### Fortalezas

✅ Arquitectura modular limpia  
✅ Sistema de temas dinámico potente  
✅ Autenticación robusta con Supabase  
✅ Código sin dependencias pesadas  
✅ Fácil de personalizar desde BD  

### Debilidades

⚠️ app-init.js demasiado grande  
⚠️ Falta de tests  
⚠️ Credenciales expuestas  
⚠️ Manejo de errores fragmentado  

### Recomendación Final

El proyecto está en buen estado para producción, pero se beneficiaría significativamente de:
1. Refactorización de `app-init.js`
2. Implementación de tests básicos
3. Mejora en seguridad (credenciales, CSP)
4. Documentación de APIs internas

**Calificación General: 8/10**

---

**Análisis realizado por:** Auto (Cursor AI)  
**Fecha:** Noviembre 2025

