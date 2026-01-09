# 🔄 Migración de Base de Datos - Guía de Actualización para Desarrolladores

## 📅 Fecha de Migración: 29 de Diciembre, 2025

---

## 🎯 Resumen de Cambios

Se migró la estructura de base de datos de una tabla monolítica a un diseño normalizado:

### ❌ Estructura Anterior (DEPRECADA)
```
kpi_data_sofia.conversations
├── id, chat_id, user_id
├── message_content (mensaje del usuario)
├── response (respuesta del asistente)
├── input_token, output_token, tokens
└── user_channel, system_channel, file
```

### ✅ Nueva Estructura (ACTUAL)
```
kpidata.conversations                kpidata.messages
├── chat_id (PK)                    ├── id (PK)
├── title                           ├── chat_id (FK)
├── created_at                      ├── role (user/assistant/system)
├── updated_at                      ├── content
├── metadata (JSONB)                ├── message_type
├── user_assign                     ├── tokens
└── role_assign                     ├── input_tokens
                                    ├── output_tokens
                                    └── user_id
```

---

## 📊 Estadísticas de la Migración

| Métrica | Valor |
|---------|-------|
| **Registros migrados** | 27,022 |
| **Conversaciones creadas** | 4,362 |
| **Mensajes totales** | 54,058 |
| **Duplicados unificados** | 5 |
| **Tasa de éxito** | 100% |

---

## 🔧 Cambios en el Código

### 1. **Helper de Queries Creado**

Archivo: `conversation-queries.js`

Este helper facilita trabajar con las nuevas tablas. Importar en `index.html`:

```html
<script src="conversation-queries.js"></script>
```

### 2. **Ejemplos de Uso**

#### ❌ Código Antiguo (NO USAR)
```javascript
// Obtener conversaciones
const { data } = await supabase
  .from('kpi_data_sofia.conversations')
  .select('*');
```

#### ✅ Código Nuevo (RECOMENDADO)
```javascript
// Opción 1: Usar el helper
const data = await ConversationQueries.getRecentConversations(10);

// Opción 2: Query directo
const { data } = await supabase
  .schema('kpidata')
  .from('conversations')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(10);
```

---

## 📚 Métodos Disponibles en `ConversationQueries`

### **Consultas de Conversaciones**

```javascript
// Obtener conversación con mensajes
const { conversation, messages } = await ConversationQueries
  .getConversationWithMessages('584122871080');

// Conversaciones recientes
const recent = await ConversationQueries.getRecentConversations(10);

// Resumen con estadísticas
const summary = await ConversationQueries.getConversationSummary('584122871080');

// Buscar por canal
const whatsappChats = await ConversationQueries
  .getConversationsByChannel('Whatsapp_Chatwoot');

// Estadísticas por rango de fechas
const stats = await ConversationQueries.getConversationStats(
  '2025-12-01T00:00:00Z',
  '2025-12-29T23:59:59Z'
);
```

### **Crear y Actualizar**

```javascript
// Crear nueva conversación
const newConv = await ConversationQueries.createConversation({
  chat_id: '584123456789',
  title: 'Nueva conversación',
  metadata: { user_channel: 'Whatsapp_Chatwoot' }
});

// Agregar mensaje
const newMsg = await ConversationQueries.addMessage({
  chat_id: '584123456789',
  role: 'user',
  content: 'Hola, necesito ayuda',
  message_type: 'text',
  user_id: 'user_123'
});

// Actualizar metadata
await ConversationQueries.updateConversationMetadata('584123456789', {
  estado: 'resuelto',
  tags: ['soporte', 'urgente']
});

// Asignar a usuario
await ConversationQueries.assignConversation(
  '584123456789',
  'uuid-del-usuario'
);
```

### **Búsqueda**

```javascript
// Buscar en contenido de mensajes
const results = await ConversationQueries.searchMessages('pago', 50);

// Mensajes de un usuario
const userMsgs = await ConversationQueries.getMessagesByUser('user_123', 100);
```

---

## 🔍 Vista de Resumen

Existe una vista SQL optimizada: `kpidata.v_conversations_summary`

```javascript
const { data } = await supabase
  .schema('kpidata')
  .from('v_conversations_summary')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(10);
```

Campos disponibles:
- `chat_id`, `title`, `created_at`, `updated_at`
- `user_assign`, `role_assign`
- `total_messages` - Contador agregado
- `total_tokens` - Suma de tokens
- `last_message_at` - Último mensaje

---

## 🔄 Compatibilidad con Código Legacy

### Vista de Compatibilidad

Se creó una vista con el nombre anterior para mantener compatibilidad:

```javascript
// Este código ANTIGUO seguirá funcionando
const { data } = await supabase
  .from('kpi_data_sofia.conversations')
  .select('*');

// Pero internamente consulta las nuevas tablas
```

⚠️ **Nota**: La vista es solo para transición. Migra a las nuevas tablas lo antes posible.

---

## 📁 Estructura de `metadata` (JSONB)

El campo `metadata` en `conversations` almacena:

```json
{
  "original_schema": "kpi_data_sofia",
  "user_channel": "Whatsapp_Chatwoot",
  "system_channel": "sofia_v1",
  "has_files": false,
  "migrated_at": "2025-12-29T...",
  "total_messages_at_migration": 567,
  "original_chat_id_format": "584122871080@s.whatsapp.net"
}
```

Puedes agregar tus propios campos:

```javascript
await ConversationQueries.updateConversationMetadata(chatId, {
  priority: 'high',
  tags: ['vip', 'urgente'],
  assigned_date: new Date().toISOString()
});
```

---

## 🗑️ Tabla de Backup

La tabla original se renombró a:
```
kpi_data_sofia.conversations_backup_20251229
```

**Mantenerla por 2-4 semanas** antes de eliminar.

Para eliminar después de validar:
```sql
DROP TABLE kpi_data_sofia.conversations_backup_20251229;
```

---

## 📋 Checklist de Migración por Módulo

### ✅ Módulos Actualizados

- [x] **livechat** - Ya usa `kpidata.conversations` y `kpidata.messages`
- [x] **Helper global** - `ConversationQueries` disponible
- [x] **index.html** - Script incluido

### 📝 Módulos a Revisar (si usan conversaciones)

- [ ] **sofia-dashboard** - Usa `kpi_data_sofia.reportes` (no afectado)
- [ ] **monitor-clientes** - Revisar si usa conversaciones
- [ ] **dashboard/users** - No usa conversaciones
- [ ] **Integraciones N8N** - Verificar workflows externos

---

## 🚀 Testing

### Probar en Desarrollo

```javascript
// 1. Verificar que el helper está disponible
console.log(window.ConversationQueries);

// 2. Probar query simple
const recent = await ConversationQueries.getRecentConversations(5);
console.log('Conversaciones recientes:', recent);

// 3. Probar conversación con mensajes
const { conversation, messages } = await ConversationQueries
  .getConversationWithMessages(recent[0].chat_id);
console.log('Conversación:', conversation);
console.log('Mensajes:', messages.length);
```

### Verificar en Supabase Dashboard

1. Ir a **Table Editor**
2. Verificar que existen:
   - `kpidata.conversations`
   - `kpidata.messages`
   - `kpidata.v_conversations_summary`

---

## ⚠️ Problemas Conocidos y Soluciones

### Problema: "relation kpidata.conversations does not exist"

**Solución**: Asegúrate de usar `.schema('kpidata')`

```javascript
// ❌ Incorrecto
supabase.from('conversations')

// ✅ Correcto
supabase.schema('kpidata').from('conversations')
```

### Problema: Permisos insuficientes

**Solución**: Configurar RLS en Supabase Dashboard o contactar administrador.

---

## 📞 Soporte

Para dudas sobre la migración:

1. Revisar este documento
2. Consultar `conversation-queries.js` para ejemplos
3. Ver módulo `livechat` como referencia
4. Contactar al equipo de desarrollo

---

## 🎉 Beneficios de la Nueva Estructura

✅ **Mejor rendimiento** - Queries optimizadas con índices  
✅ **Escalabilidad** - Separación de concerns  
✅ **Flexibilidad** - Metadata en JSON para extensiones  
✅ **Integridad** - Foreign keys garantizan consistencia  
✅ **Análisis** - Vista de resumen con agregados  
✅ **Mantenimiento** - Código más limpio y modular  

---

**Última actualización**: 2025-12-29  
**Versión**: 2.0.0
