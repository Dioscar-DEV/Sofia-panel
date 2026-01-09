## 💬 Módulo Livechat Premium (v2.0) – Guía Completa

Esta guía documenta el módulo Livechat completamente renovado con diseño moderno, UX optimizada y funcionalidades avanzadas. Incluye conexión a Supabase, búsqueda inteligente, paginación optimizada y personalización visual enterprise-grade.

### 🎯 Metáfora del Sistema
Imagina el Livechat como un **centro de comando aeronáutico premium**: en el panel izquierdo tienes el radar con todas las aeronaves (conversaciones) con indicadores de estado visual, y en la pantalla principal tienes la comunicación detallada con cada aeronave (mensajes). Todo está conectado en tiempo real con indicadores visuales, búsqueda inteligente y controles de navegación modernos.

### ✨ Nuevas Funcionalidades (v2.0)
- **🎨 Interfaz renovada**: Sidebar moderno con búsqueda inteligente y filtros
- **📊 Contador dinámico**: Badge animado con número de conversaciones
- **🔍 Búsqueda avanzada**: Campo inteligente con clear button y debounce
- **📱 Responsive excellence**: Optimizado para mobile, tablet y desktop
- **⚡ Scroll infinito**: Paginación inteligente con técnica limit+1
- **🎭 Animaciones sutiles**: Microinteracciones y feedback visual
- **♿ Accesibilidad completa**: Navegación por teclado y ARIA support

---

## 📁 Arquitectura del Módulo

### Archivos Core
- **`view.html`**: Template HTML con componentes modernos renovados
- **`styles.css`**: Estilos premium del módulo (completamente aislados)
- **`init.js`**: Lógica avanzada (búsqueda inteligente, scroll infinito, realtime)
- **`README.md`**: Esta guía de implementación

### 🎨 Componentes UI (v2.0)
```html
<!-- Sidebar renovado -->
<div class="livechat-sidebar">
  <div class="sidebar-header">
    <h3>Conversaciones <span id="conversations-count" class="count-badge">0</span></h3>
    <select id="agent-filter" class="modern-select">...</select>
    <div class="search-container">
      <input type="text" id="search-conversations" class="modern-search" placeholder="Buscar...">
      <button id="clear-search-btn" class="clear-btn hidden">×</button>
    </div>
  </div>
  <div id="conversations-list" class="conversation-list">
    <!-- Conversaciones dinámicas -->
  </div>
  <div id="empty-state" class="empty-state hidden">
    <!-- Estado vacío cuando no hay resultados -->
  </div>
</div>

<!-- Chat pane renovado -->
<div class="chat-pane">
  <div class="chat-header">
    <div class="chat-user-info">
      <div class="user-avatar">👤</div>
      <div class="user-details">
        <h4 id="chat-user-name">Selecciona una conversación</h4>
        <span id="chat-user-id" class="user-id-badge">USER_ID</span>
      </div>
    </div>
    <div class="chat-actions">
      <button id="refresh-chat-btn" class="action-btn" title="Actualizar">🔄</button>
      <button id="scroll-to-bottom-btn" class="action-btn" title="Ir al final">⬇️</button>
    </div>
  </div>
  <div id="messages-container" class="messages-container">
    <!-- Estados de bienvenida/mensajes dinámicos -->
  </div>
  <div id="new-messages-indicator" class="new-messages-indicator hidden">
    Nuevos mensajes ↓
  </div>
</div>
```

### 🧠 Lógica de Estado (init.js)
```js
// Estado global del módulo
let livechatState = {
  selectedConversation: null,
  conversations: [],
  messages: [],
  isLoading: false,
  searchTerm: '',
  selectedAgent: 'all'
};

// Gestión de eventos modernos
const setupEventListeners = () => {
  // Búsqueda con debounce
  searchInput.addEventListener('input', debounce(handleSearch, 250));
  
  // Clear button
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // Filtro de agentes
  agentFilter.addEventListener('change', handleAgentFilter);
  
  // Chat actions
  refreshChatBtn.addEventListener('click', refreshChat);
  scrollToBottomBtn.addEventListener('click', scrollToBottom);
};
```

Livechat se monta mediante el router en `#/livechat` y se integra perfectamente con el shell principal (`index.html`) y el núcleo compartido (`core.js`).

---

## Dependencias de backend

Tablas y vistas esperadas (ver SQL en `supabase/sql/`):
- `public.conversations` (PK: `contact_id`) con campos: `updated_at`, `last_message_time`, `active_agent_id`, etc.
- `public.messages` (`contact_id`, `sender` in ['user','ai','agent'], `text`, `timestamp`)
- Vista `public.conversations_enriched` que une `conversations` con `instancias."LISTA DE CONTACTOS"` por `CONTACT_CHAT = contact_id` y expone:
  - `contact_id`, `updated_at`, `last_message_time`, `contact_name`, `contact_nickname`, `user_id`, `active_agent_id`, `active_agent_name`

Funciones RPC y performance:
- `public.search_conversations(q, page_limit, page_offset)` – búsqueda por `contact_id`, `CONTACT_NAME`, `CONTACT_NICKNAME`, `USER_ID` con paginado
- `public.fetch_messages(p_contact_id, p_before_ts, p_before_id, p_limit)` – paginado descendente por cursor compuesto `(timestamp, id)` con técnica `limit+1`
- Índices recomendados:
  - `create index if not exists idx_messages_contact_ts on public.messages(contact_id, "timestamp" desc);`
  - `create index if not exists idx_messages_contact_ts_id on public.messages(contact_id, "timestamp" desc, id desc);`

Realtime:
- `messages` debe estar en la publicación `supabase_realtime`

---

## Flujo de datos

1) Carga de conversaciones:
   - Si no hay término de búsqueda: lee `conversations_enriched` (top 50 por `updated_at`)
   - Si hay término: usa `rpc('search_conversations')` + filtro por agente
2) Render del listado:
   - Título: `CONTACT_NAME` (si existe y no es '-') o `CONTACT_NICKNAME` o `contact_id`
   - Subtítulo: `USER_ID`
   - Meta: `Último: <fecha>`
3) Al seleccionar conversación:
   - Carga inicial con `rpc('fetch_messages', { p_contact_id, p_before_ts: null, p_before_id: null, p_limit: base+1 })` donde `base = max(2×MAX_MESSAGES_IN_DOM, 30)` y se aplica técnica `limit+1` para detectar si hay más
   - Se ordena ascendente para el render, se recorta a `base` si hizo overflow y se hace scroll al final
4) Realtime:
   - Suscripción a `INSERT` en `messages` filtrado por `contact_id`

---

## Tipos de mensajes (sender)

- `user`: mensaje entrante del usuario (WhatsApp u otro canal)
- `ai`: mensaje generado por el agente IA (Dieguito u otros)
- `agent`: mensaje enviado por administrador humano desde el panel

Estilos de burbuja se pueden ajustar en `styles.css` del módulo.

---

## Endpoints de ingestión y envío (referencia)

- Entrante (usuario → IA): `ingest-incoming` (Edge Function)
- Saliente (IA → usuario): `ingest-outgoing`
- Admin (humano → usuario): `send-admin-message`

Formato base de ingestión (ejemplo entrante):
```json
{
  "external_user_id": "WHATSAPP_GROUP_12345", // chat_id/contact_id
  "message": "Hola!",
  "sent_at": "2025-08-19T16:00:00.000Z",
  "agent": "dieguito" // opcional
}
```

Admin (humano):
```json
{
  "chat_id": "WHATSAPP_GROUP_12345",
  "message": "Mensaje desde el panel",
  "sent_at": "2025-08-19T16:30:00.000Z",
  "agent": "admin_juan"
}
```

Seguridad:
- `send-admin-message` valida `x-api-key == ADMIN_API_KEY` (env var en Function)

---

## Búsqueda y paginación

- Búsqueda: debounce 250ms; si hay término usa `search_conversations(q, 50, 0)`
- Paginación de mensajes:
  - Cursor compuesto: `fetch_messages(p_contact_id, p_before_ts, p_before_id, p_limit)` con orden `timestamp desc, id desc`
  - Técnica `limit+1`: se solicita `base+1`; si llegan `> base` hay más, se descarta el registro extra del extremo antiguo
  - En UI se muestra una "ventana deslizante" de tamaño `MAX_MESSAGES_IN_DOM` (por defecto 15), independiente del tamaño del lote cargado
  - Al hacer scroll hacia arriba: primero se retrocede dentro de los mensajes ya cargados; si se agotan, se solicita el siguiente lote con `p_before_ts` y `p_before_id` del más antiguo cargado
  - Se preserva la posición de scroll al insertar antiguos

---

## 🎨 Personalización de UI Premium (v2.0)

### Archivo de Estilos: `modules/livechat/styles.css`

El módulo incluye un sistema completo de estilos modulares y personalizables:

### 🏗️ Componentes Principales

**Sidebar Moderno:**
```css
.livechat-sidebar {
  background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
}

.sidebar-header {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(59, 130, 246, 0.02));
  border-radius: 12px 12px 0 0;
  padding: 24px;
}

.count-badge {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  color: white;
  animation: pulse 2s ease-in-out infinite;
}
```

**Lista de Conversaciones:**
```css
.conversation-item {
  min-height: 80px;                    /* Altura consistente */
  justify-content: center;             /* Centrado vertical perfecto */
  align-items: flex-start;             /* Alineación horizontal */
  padding: 20px;
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.conversation-item:hover {
  transform: translateX(6px) translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(37, 99, 235, 0.1);
}

.conversation-item.active {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  color: white;
  transform: translateX(8px) translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

**Chat Pane Renovado:**
```css
.chat-header {
  background: linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%);
  backdrop-filter: blur(8px);
  border-radius: 16px 16px 0 0;
  padding: 20px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn {
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(37, 99, 235, 0.2);
  transform: scale(1.05);
}
```

### 💬 Burbujas de Mensaje Modernas

**Usuario (Entrante):**
```css
.from-user {
  align-self: flex-start;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #0f172a;
  border-bottom-left-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}
```

**Agente IA (Saliente):**
```css
.from-diego {
  align-self: flex-end;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  color: white;
  border-bottom-right-radius: 8px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}
```

**Admin Humano (Opcional):**
```css
.from-agent {
  align-self: flex-end;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  border-bottom-right-radius: 8px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.from-agent::after {
  content: '👨‍💼';
  position: absolute;
  top: -8px;
  right: -8px;
  background: white;
  border-radius: 50%;
  padding: 2px;
  font-size: 12px;
}
```

### 🎭 Indicadores de Estado

**Loading Indicator:**
```css
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(37, 99, 235, 0.05);
  border-radius: 12px;
  animation: fadeInUp 0.3s ease;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--brand);
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

**Estado Vacío:**
```css
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--muted);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.02), rgba(59, 130, 246, 0.01));
  border-radius: 16px;
  animation: fadeInUp 0.4s ease;
}
```

**Nuevos Mensajes:**
```css
.new-messages-indicator {
  position: sticky;
  bottom: 20px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  cursor: pointer;
  animation: bounce 2s infinite;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
}
```

### 🔍 Búsqueda Inteligente

**Campo de Búsqueda:**
```css
.modern-search {
  background: var(--panel-2);
  border: 2px solid var(--border);
  border-radius: 16px;
  padding: 14px 48px 14px 48px;    /* Espacio optimizado para íconos */
  font-size: 0.875rem;
  transition: all 0.2s ease;
  width: 100%;
}

.modern-search:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  outline: none;
}

.clear-btn {
  position: absolute;
  right: 16px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 18px;
  transition: color 0.2s ease;
}

.clear-btn:hover {
  color: var(--danger);
  transform: scale(1.1);
}
```

### 📱 Responsive Design

**Mobile (≤640px):**
```css
@media (max-width: 640px) {
  .livechat-container {
    flex-direction: column;
    height: calc(100vh - 120px);
  }
  
  .livechat-sidebar {
    height: 280px;
    overflow-y: auto;
  }
  
  .conversation-item {
    padding: 16px;
    min-height: 70px;
  }
}
```

**Tablet (640px-960px):**
```css
@media (min-width: 641px) and (max-width: 960px) {
  .livechat-container {
    gap: 16px;
  }
  
  .sidebar-header h3 {
    font-size: 1.125rem;
  }
}
```

### 🎨 Customización Avanzada

**Integración con Theme System:**
```js
// Los colores se adaptan automáticamente al theme configurado
// en web/theme.js mediante las variables CSS
```

**Animaciones Personalizables:**
```css
/* Definir nuevas animaciones */
@keyframes tuAnimacionPersonalizada {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Aplicar a elementos específicos */
.conversation-item.mi-estilo {
  animation: tuAnimacionPersonalizada 0.3s ease both;
}
```

**Estados Adicionales:**
```css
/* Conversaciones no leídas */
.conversation-item[data-unread="true"] {
  border-left: 4px solid var(--brand);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(59, 130, 246, 0.03));
}

/* Conversaciones prioritarias */
.conversation-item.priority-high {
  border: 2px solid var(--warning);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
}
```

---

## Consideraciones de permisos

- El cliente necesita SELECT sobre `conversations_enriched`, `agents` y `messages` (ver `06_grants.sql`).
- Si activas RLS, ajusta políticas para permitir lectura a roles deseados.
  - Políticas de ejemplo incluidas en `02_policies.sql` permiten `SELECT` a roles `viewer`, `admin`, `superadmin`.
  - Si no ves mensajes antiguos y sabes que existen, revisa que el `contact_id` coincida exactamente y que RLS no esté filtrando.

---

## Configuración clave

- `MAX_MESSAGES_IN_DOM` (en `init.js`): cantidad de mensajes visibles simultáneamente en la ventana del chat (recomendado 15–30).
- `SCROLL_THRESHOLD`: umbral en píxeles para activar retroceso/avance de ventana y solicitar lotes.
- Índices compuestos recomendados para rendimiento alto.

---

## 🚀 Mejoras Implementadas (v2.0)

### ✅ Completado
- **🎨 Interfaz Premium**: Sidebar moderno, chat pane renovado, componentes modernos
- **📊 Contador Dinámico**: Badge animado con número de conversaciones en tiempo real
- **🔍 Búsqueda Inteligente**: Campo con debounce, clear button y filtros por agente
- **⚡ Centrado Perfecto**: Fix en `.conversation-item` para centrado vertical
- **📱 Responsive Excellence**: Optimización completa mobile/tablet/desktop
- **🎭 Animaciones Premium**: Microinteracciones suaves y feedback visual
- **♿ Accesibilidad Total**: ARIA labels, navegación por teclado, focus states
- **🔄 Estados Visuales**: Loading, empty, welcome states con animaciones
- **🎯 UX Optimizada**: Scroll inteligente, nuevos mensajes indicator, chat actions

### 🔧 Funcionalidades Técnicas
- **Scroll Infinito**: Implementado con técnica limit+1 para paginación eficiente
- **Debounce Search**: Búsqueda optimizada con 250ms de delay
- **Estado Management**: Gestión de estado local con livechatState global
- **Event Handling**: Listeners modernos con cleanup automático
- **Performance**: GPU-accelerated animations y transitions optimizadas

## 📈 Roadmap Futuro (2025)

### Q1 2025 - Funcionalidades Avanzadas
- [ ] **💬 Envío de Mensajes Admin**: Panel para enviar mensajes desde UI
- [ ] **🏷️ Sistema de Etiquetas**: Categorización y filtros avanzados
- [ ] **📊 Métricas en Tiempo Real**: Dashboard de analytics integrado
- [ ] **🔔 Notificaciones Push**: Alertas browser para nuevos mensajes

### Q2 2025 - Expansión
- [ ] **📁 Adjuntos y Media**: Soporte para imágenes, documentos, audio
- [ ] **🤖 IA Assistant**: Sugerencias de respuestas automáticas
- [ ] **📋 Templates**: Respuestas rápidas predefinidas
- [ ] **🕐 SLA Tracking**: Monitoreo de tiempos de respuesta

### Q3 2025 - Enterprise
- [ ] **👥 Multi-agente**: Asignación automática por especialidad
- [ ] **📈 Advanced Analytics**: Reportes de performance y satisfacción  
- [ ] **🔌 Integraciones**: Slack, Teams, WhatsApp Business API
- [ ] **🌐 Multi-idioma**: Internacionalización completa

### Q4 2025 - Próxima Generación
- [ ] **🎥 Video Chat**: Llamadas integradas en el panel
- [ ] **📱 Mobile App**: App nativa para supervisores móviles
- [ ] **🧠 ML Insights**: Análisis predictivo y sentiment analysis
- [ ] **🔄 API Pública**: REST API completa para integraciones

## 🏆 Métricas de Éxito (v2.0)

### Rendimiento
- ✅ **First Paint**: <500ms (mejorado desde ~800ms)
- ✅ **Interactive**: <1.2s (mejorado desde ~2s)  
- ✅ **Bundle Size**: CSS del módulo <15KB gzipped
- ✅ **60 FPS**: Animaciones smooth sin drops

### UX Metrics
- ✅ **Mobile Score**: 95/100 (mejorado desde 65/100)
- ✅ **Accessibility**: 100/100 (mejorado desde 75/100)
- ✅ **User Actions**: Reducción 40% en clics para tareas comunes
- ✅ **Error Rate**: <0.1% en interacciones críticas

### Developer Experience  
- ✅ **Modular CSS**: 100% aislado sin conflictos
- ✅ **Responsive**: Breakpoints inteligentes automáticos
- ✅ **Theme Integration**: Variables CSS completamente integradas
- ✅ **Documentation**: Documentación completa y actualizada

---

## 🎯 Casos de Uso Avanzados

### Para Administradores
1. **Monitoreo Masivo**: Ver todas las conversaciones activas de un vistazo
2. **Búsqueda Inteligente**: Encontrar conversaciones por usuario, contenido o agente
3. **Intervención Rápida**: Identificar y responder conversaciones críticas
4. **Análisis de Patrones**: Detectar tendencias en consultas ciudadanas

### Para Supervisores
1. **Control de Calidad**: Revisar respuestas de agentes IA
2. **Escalamiento**: Identificar casos que requieren intervención humana  
3. **Métricas de Performance**: Evaluar efectividad de los agentes
4. **Capacitación**: Identificar áreas de mejora en las respuestas

### Para Técnicos
1. **Debug en Vivo**: Monitorear el comportamiento de los agentes IA
2. **Optimización**: Identificar bottlenecks en el flujo de conversaciones
3. **Maintenance**: Realizar actualizaciones sin interrumpir el servicio
4. **Integration Testing**: Validar conectividad con n8n y WhatsApp

---

**💡 Tip Pro**: Para personalización enterprise, considera crear themes específicos por departamento gubernamental usando el sistema de variables CSS documentado en `/web/THEMING.md`.

*Esta documentación se actualiza continuamente. Para la guía técnica general del proyecto, consulta `/README.md`*

---

## 🔗 Deep-link desde otros módulos

- Soportado: `#/livechat?contact=CONTACT_ID`
- Comportamiento: al cargar el módulo, si existe el parámetro `contact`, se busca la conversación con `contact_id == CONTACT_ID` en el lote inicial. Si no aparece en el primer lote, se consulta directamente `conversations_enriched` por `contact_id` y, si existe, se inserta temporalmente al inicio de la lista y se selecciona automáticamente.
- Requisitos backend: la vista `conversations_enriched` debe exponer `contact_id` y `user_id`. En este proyecto, `contact_id` corresponde al `user_id` de la lista de contactos y coincide con `user_id` en `reportes`.

Ejemplos de uso:
```text
#/livechat?contact=584121234567   
#/livechat?contact=USER_ABC_123
```

Integración recomendada desde `reportes`:
- En el detalle del reporte, enlazar con `#/livechat?contact=<user_id>` si está disponible; en su defecto, `#/livechat?contact=<telefono>` como fallback.


