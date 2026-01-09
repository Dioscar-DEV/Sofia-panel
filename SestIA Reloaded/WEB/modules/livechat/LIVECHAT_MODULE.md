# Módulo Livechat - Documentación Técnica

## Descripción General

El módulo **Livechat** es un sistema de supervisión de conversaciones en tiempo real que permite visualizar y monitorear las interacciones entre usuarios (WhatsApp) y agentes IA/humanos. Está diseñado para integrarse con Supabase como backend.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Web)                           │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │   Sidebar       │    │         Chat Panel                  │ │
│  │  - Filtros      │    │  - Header conversación              │ │
│  │  - Búsqueda     │    │  - Mensajes (scroll infinito)       │ │
│  │  - Lista conv.  │    │  - Multimedia (img/video/audio/loc) │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ conversations│  │   messages   │  │       agents          │  │
│  │   (6,886)    │  │  (163,352)   │  │        (1)            │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              instancias."LISTA DE CONTACTOS"             │   │
│  │                        (8,556)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Edge Functions                        │   │
│  │    ingest-incoming  │  ingest-outgoing                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tablas de Base de Datos

### 1. `public.conversations`

Tabla principal de conversaciones.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `contact_id` | `text` | **PK** - Identificador único del contacto (chat_id de WhatsApp) |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Última actualización (trigger automático) |
| `is_blacklisted` | `boolean` | Si el contacto está en lista negra |
| `last_message_time` | `timestamptz` | Timestamp del último mensaje |
| `last_message_text` | `text` | Texto del último mensaje |
| `last_message_sender` | `text` | Remitente del último mensaje |
| `active_agent_id` | `text` | FK → agents.id - Agente activo |
| `last_agent_id` | `text` | FK → agents.id - Último agente |

**Índices:**
- `idx_conversations_updated_at` (updated_at DESC)
- `idx_conversations_blacklisted` (is_blacklisted)
- `idx_conversations_active_agent` (active_agent_id)

**RLS:** Habilitado

---

### 2. `public.messages`

Almacena todos los mensajes de las conversaciones.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `serial` | **PK** - ID autoincremental |
| `contact_id` | `text` | FK → conversations.contact_id |
| `text` | `text` | Contenido del mensaje |
| `sender` | `text` | Remitente: `'user'`, `'agent'`, `'ai'` |
| `timestamp` | `timestamptz` | Fecha/hora del mensaje |
| `created_at` | `timestamptz` | Fecha de inserción en BD |
| `agent_id` | `text` | FK → agents.id |
| `media_type` | `text` | Tipo: `image`, `video`, `audio`, `sticker`, `document`, `location` |
| `media_url` | `text` | URL del archivo multimedia |
| `mime_type` | `text` | MIME type (ej: `image/jpeg`) |
| `file_name` | `text` | Nombre original del archivo |
| `latitude` | `numeric` | Latitud (ubicaciones) |
| `longitude` | `numeric` | Longitud (ubicaciones) |
| `location_name` | `text` | Nombre del lugar |
| `location_address` | `text` | Dirección del lugar |

**Índices:**
- `idx_messages_contact_id` (contact_id)
- `idx_messages_timestamp` (timestamp DESC)
- `idx_messages_contact_ts` (contact_id, timestamp DESC)
- `idx_messages_agent_id` (agent_id)

**RLS:** Habilitado

**Realtime:** Habilitado (`supabase_realtime`)

---

### 3. `public.agents`

Catálogo de agentes IA.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `text` | **PK** - Identificador del agente |
| `display_name` | `text` | Nombre para mostrar |
| `is_active` | `boolean` | Si está activo (default: true) |
| `metadata` | `jsonb` | Datos adicionales |
| `created_at` | `timestamptz` | Fecha de creación |

**RLS:** Habilitado

---

### 4. `instancias."LISTA DE CONTACTOS"`

Información enriquecida de contactos (schema separado).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigint` | PK autoincremental |
| `USER_ID` | `text` | ID único del usuario (UNIQUE) |
| `CONTACT_CHAT` | `text` | ID de chat (link a conversations.contact_id) |
| `CONTACT_NAME` | `text` | Nombre del contacto |
| `CONTACT_NICKNAME` | `text` | Apodo |
| `CONTACT_PHONE` | `text` | Teléfono |
| `CONTACT_EMAIL` | `text` | Email |
| `CONTACT_COMPANY` | `text` | Empresa |
| `CONTACT_LAST_CHANNEL` | `text` | Último canal usado (ej: `WHATSAPP_1`) |
| `CONTACT_DOCID` | `text` | Documento de identidad |
| `CONTACT_GENDER` | `text` | Género |
| `CONTACT_BIRTHDAY` | `date` | Fecha de nacimiento |
| ... | ... | Otros campos demográficos |

---

## Vista

### `conversations_enriched`

Vista que combina conversaciones con datos de contactos y agentes.

```sql
CREATE VIEW conversations_enriched AS
SELECT
  c.contact_id,
  c.updated_at,
  c.last_message_time,
  c.last_message_text,
  c.last_message_sender,
  c.is_blacklisted,
  c.active_agent_id,
  c.last_agent_id,
  a.display_name AS active_agent_name,
  la.display_name AS last_agent_name,
  l."CONTACT_NAME" AS contact_name,
  l."USER_ID" AS user_id,
  l."CONTACT_PHONE" AS contact_phone,
  l."CONTACT_EMAIL" AS contact_email,
  l."CONTACT_NICKNAME" AS contact_nickname,
  l."CONTACT_COMPANY" AS contact_company,
  l."CONTACT_LAST_CHANNEL" AS contact_last_channel
FROM conversations c
LEFT JOIN instancias."LISTA DE CONTACTOS" l
  ON l."CONTACT_CHAT" = c.contact_id
LEFT JOIN agents a ON a.id = c.active_agent_id
LEFT JOIN agents la ON la.id = c.last_agent_id;
```

---

## Funciones RPC

### 1. `conversations_enriched_list(p_limit)`

Lista conversaciones enriquecidas con paginación.

```sql
-- Parámetros:
--   p_limit: int (default 50, max 200)
-- Retorna: TABLE (contact_id, updated_at, last_message_time,
--                 contact_name, contact_nickname, user_id,
--                 active_agent_id, contact_last_channel)

SELECT * FROM conversations_enriched_list(50);
```

**Uso en frontend:**
```javascript
const { data } = await supabase.rpc('conversations_enriched_list', { p_limit: 50 });
```

---

### 2. `search_conversations(q, page_limit, page_offset)`

Búsqueda de conversaciones por texto.

```sql
-- Parámetros:
--   q: text - Término de búsqueda
--   page_limit: int (default 50)
--   page_offset: int (default 0)
-- Busca en: contact_id, CONTACT_NAME, CONTACT_NICKNAME, USER_ID

SELECT * FROM search_conversations('juan', 50, 0);
```

**Uso en frontend:**
```javascript
const { data } = await supabase.rpc('search_conversations', {
  q: 'juan',
  page_limit: 100,
  page_offset: 0
});
```

---

### 3. `fetch_messages(p_contact_id, p_before_ts, p_before_id, p_limit)`

Paginación de mensajes con cursor compuesto (scroll infinito hacia arriba).

```sql
-- Parámetros:
--   p_contact_id: text - ID del contacto
--   p_before_ts: timestamptz (null para primera carga)
--   p_before_id: int (null para primera carga)
--   p_limit: int (default 50)
-- Retorna: TABLE con todos los campos de messages incluyendo multimedia

-- Primera carga (mensajes más recientes)
SELECT * FROM fetch_messages('contact123', NULL, NULL, 50);

-- Cargar más antiguos (paginación)
SELECT * FROM fetch_messages('contact123', '2024-01-15T10:00:00Z', 12345, 50);
```

**Uso en frontend:**
```javascript
// Primera carga
const { data } = await supabase.rpc('fetch_messages', {
  p_contact_id: contactId,
  p_before_ts: null,
  p_before_id: null,
  p_limit: 50
});

// Cargar más antiguos
const oldestMessage = messages[0];
const { data: older } = await supabase.rpc('fetch_messages', {
  p_contact_id: contactId,
  p_before_ts: oldestMessage.timestamp,
  p_before_id: oldestMessage.id,
  p_limit: 50
});
```

---

### 4. `get_unique_channels()`

Obtiene lista de canales únicos disponibles.

```sql
-- Sin parámetros
-- Retorna: TABLE (channel text)

SELECT * FROM get_unique_channels();
-- Resultado: WHATSAPP_1, WHATSAPP_2, WHATSAPP_3, etc.
```

**Uso en frontend:**
```javascript
const { data } = await supabase.rpc('get_unique_channels');
// data = [{ channel: 'WHATSAPP_1' }, { channel: 'WHATSAPP_2' }, ...]
```

---

## Edge Functions

### 1. `ingest-incoming`

Recibe mensajes **entrantes** del usuario (desde WhatsApp).

**Endpoint:** `POST /functions/v1/ingest-incoming`

**Headers:**
- `Authorization: Bearer <JWT>` (verify_jwt: true)
- `x-api-key: <INGEST_API_KEY>` (opcional, si está configurado)

**Body:**
```json
{
  "external_user_id": "584241234567@c.us",
  "message": "Hola, necesito ayuda",
  "sent_at": "2024-01-15T10:30:00Z",
  "agent": "dieguito-v1"
}
```

**Response:**
```json
{
  "conversation_id": "584241234567@c.us",
  "message_id": 12345,
  "sent_at": "2024-01-15T10:30:00.000Z",
  "status": "ok"
}
```

**Lógica:**
1. Valida API key si está configurada
2. Upsert en `conversations` (crea si no existe)
3. Insert en `messages` con `sender: 'user'`

---

### 2. `ingest-outgoing`

Recibe mensajes **salientes** del agente IA.

**Endpoint:** `POST /functions/v1/ingest-outgoing`

**Headers:** Igual que ingest-incoming

**Body:**
```json
{
  "external_user_id": "584241234567@c.us",
  "message": "¡Hola! ¿En qué puedo ayudarte?",
  "sent_at": "2024-01-15T10:30:05Z",
  "agent": "dieguito-v1"
}
```

**Lógica:**
1. Valida API key si está configurada
2. Upsert en `conversations`
3. Insert en `messages` con `sender: 'ai'`

---

## Triggers Automáticos

### 1. `update_conversations_updated_at`
Actualiza `updated_at` automáticamente al modificar una conversación.

### 2. `update_conversation_last_message_trigger`
Al insertar un mensaje, actualiza automáticamente en `conversations`:
- `last_message_time`
- `last_message_text`
- `last_message_sender`
- `last_agent_id`

---

## Suscripción en Tiempo Real

El módulo usa Supabase Realtime para recibir mensajes nuevos:

```javascript
const subscription = supabase
  .channel('room:messages:' + contactId)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `contact_id=eq.${contactId}`
  }, (payload) => {
    const newMessage = payload.new;
    // Agregar mensaje a la UI
  })
  .subscribe();
```

---

## Archivos del Módulo Frontend

```
modules/livechat/
├── init.js      # Lógica principal (~1045 líneas)
├── view.html    # Template HTML
└── styles.css   # Estilos (~1490 líneas)
```

### Características del Frontend

1. **Filtros:**
   - Por agente (`agents` table)
   - Por canal (`get_unique_channels` RPC)
   - Búsqueda de texto

2. **Paginación Inteligente:**
   - Scroll infinito hacia arriba (mensajes antiguos)
   - Ventana deslizante para optimizar DOM
   - Indicador "principio de conversación"

3. **Multimedia:**
   - Imágenes con lightbox
   - Videos con reproductor nativo
   - Audios con reproductor
   - Documentos con descarga
   - Ubicaciones con mapa estático + Google Maps
   - Stickers

4. **Autenticación de Media:**
   - Soporte para signed URLs
   - Soporte para authenticated URLs
   - Cache de blob URLs

5. **UI/UX:**
   - Modo oscuro
   - Responsive design
   - Indicador de mensajes nuevos
   - Estados vacío/bienvenida

---

## Configuración MCP Supabase

Para acceder a la BD desde Claude Code:

```bash
claude mcp add supabase_dieguito \
  -e SUPABASE_ACCESS_TOKEN=sbp_xxxxx \
  -- npx -y @supabase/mcp-server-supabase \
  --project-ref olpcybahwazpnpimafgp
```

---

## Migración a Otro Proyecto

### 1. Crear Tablas

```sql
-- 1. Tabla conversations
CREATE TABLE public.conversations (
  contact_id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_blacklisted boolean DEFAULT false,
  last_message_time timestamptz,
  last_message_text text,
  last_message_sender text,
  active_agent_id text,
  last_agent_id text
);

-- 2. Tabla agents
CREATE TABLE public.agents (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 3. Tabla messages
CREATE TABLE public.messages (
  id serial PRIMARY KEY,
  contact_id text REFERENCES conversations(contact_id) ON DELETE CASCADE,
  text text NOT NULL,
  sender text NOT NULL CHECK (sender IN ('user', 'agent', 'ai')),
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  media_type text,
  media_url text,
  mime_type text,
  file_name text,
  latitude numeric,
  longitude numeric,
  location_name text,
  location_address text
);

-- 4. Índices
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_contact_ts ON messages(contact_id, timestamp DESC);

-- 5. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### 2. Crear Triggers

```sql
-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger last_message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET last_message_time = NEW.timestamp,
      last_message_text = NEW.text,
      last_message_sender = NEW.sender,
      last_agent_id = NEW.agent_id,
      updated_at = now()
  WHERE contact_id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
```

### 3. Crear RPCs

```sql
-- fetch_messages (paginación con cursor)
CREATE OR REPLACE FUNCTION fetch_messages(
  p_contact_id text,
  p_before_ts timestamptz DEFAULT NULL,
  p_before_id int DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id int, contact_id text, sender text, text text,
  timestamp timestamptz, agent_id text,
  media_type text, media_url text, mime_type text, file_name text,
  latitude numeric, longitude numeric, location_name text, location_address text
)
LANGUAGE sql STABLE AS $$
  SELECT id, contact_id, sender, text, timestamp, agent_id,
         media_type, media_url, mime_type, file_name,
         latitude, longitude, location_name, location_address
  FROM messages
  WHERE contact_id = p_contact_id
    AND (p_before_ts IS NULL
         OR (timestamp, id) < (p_before_ts, COALESCE(p_before_id, 2147483647)))
  ORDER BY timestamp DESC, id DESC
  LIMIT p_limit;
$$;
```

### 4. Copiar Frontend

Copiar la carpeta `modules/livechat/` completa:
- `init.js`
- `view.html`
- `styles.css`

### 5. Desplegar Edge Functions

Usar el MCP o Supabase CLI para desplegar:
- `ingest-incoming`
- `ingest-outgoing`

---

## Variables de Entorno Requeridas

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx

# Edge Functions (opcional)
INGEST_API_KEY=tu-api-key-secreto
```

---

## Autor

Documentación generada automáticamente con Claude Code + MCP Supabase.

**Proyecto:** Comando de Gestión - Dieguito
**Fecha:** 2024
