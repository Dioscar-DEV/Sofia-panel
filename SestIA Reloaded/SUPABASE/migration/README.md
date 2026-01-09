# Migración de Base de Datos - SestIA Reloaded

## 📋 Descripción

Migración de la estructura monolítica `kpi_data_sofia.conversations` a una arquitectura normalizada con dos tablas separadas:
- **`kpidata.conversations`** - Nivel de conversación/chat
- **`kpidata.messages`** - Mensajes individuales dentro de cada chat

## 🎯 Objetivo

Transformar una tabla que mezcla conversaciones y mensajes en una estructura normalizada que:
- Mejora la integridad referencial
- Facilita consultas y análisis
- Escala mejor con el crecimiento de datos
- Permite agregar metadata de forma estructurada

## 📁 Archivos de Migración

### Orden de Ejecución

| # | Archivo | Descripción | ¿Modifica DB? |
|---|---------|-------------|---------------|
| 0 | `00_migration_master.sql` | **Script maestro** - Ejecuta todo el proceso | ✅ Sí |
| 1 | `01_analisis_datos_actuales.sql` | Analiza datos existentes | ❌ No (solo SELECT) |
| 2 | `02_crear_nuevas_tablas.sql` | Crea estructura normalizada | ✅ Sí (CREATE) |
| 3 | `03_migrar_datos.sql` | Transfiere datos a nueva estructura | ✅ Sí (INSERT) |
| 4 | `04_validacion_post_migracion.sql` | Valida integridad post-migración | ❌ No (solo SELECT) |

## 🚀 Ejecución

### Opción 1: Script Maestro (Recomendado)

Ejecuta todo el proceso de una vez:

```bash
# Desde psql
psql -U tu_usuario -d tu_base_de_datos -f 00_migration_master.sql

# O desde Supabase SQL Editor
# Copia y pega el contenido de 00_migration_master.sql
```

### Opción 2: Paso a Paso

Para mayor control, ejecuta cada script individualmente:

```bash
# 1. Analizar datos (opcional pero recomendado)
psql -U tu_usuario -d tu_base_de_datos -f 01_analisis_datos_actuales.sql

# 2. Crear estructura
psql -U tu_usuario -d tu_base_de_datos -f 02_crear_nuevas_tablas.sql

# 3. Migrar datos
psql -U tu_usuario -d tu_base_de_datos -f 03_migrar_datos.sql

# 4. Validar
psql -U tu_usuario -d tu_base_de_datos -f 04_validacion_post_migracion.sql
```

## 📊 Estructura Resultante

### Tabla: `kpidata.conversations`

```sql
Column       | Type                     | Descripción
-------------|--------------------------|----------------------------------
chat_id      | TEXT (PK)               | ID único de la conversación
created_at   | TIMESTAMP WITH TIME ZONE| Fecha de inicio
title        | TEXT                    | Título (primeros 50 chars del 1er mensaje)
metadata     | JSONB                   | Canal, tags, info adicional
updated_at   | TIMESTAMP WITH TIME ZONE| Última actividad
user_assign  | UUID (FK → profiles)    | Usuario asignado
role_assign  | TEXT (FK → roles)       | Rol asignado
```

### Tabla: `kpidata.messages`

```sql
Column          | Type                     | Descripción
----------------|--------------------------|----------------------------------
id              | BIGINT (PK, AI)         | ID autoincremental
created_at      | TIMESTAMP WITH TIME ZONE| Fecha del mensaje
role            | TEXT                    | 'user', 'assistant', 'system'
content         | TEXT                    | Contenido del mensaje
message_type    | TEXT                    | 'text', 'image', 'audio', etc.
media_url       | TEXT                    | URL de multimedia
tokens          | BIGINT                  | Tokens consumidos
chat_id         | TEXT (FK → conversations)| Referencia a conversación
media_id        | UUID                    | ID de multimedia
media_directory | TEXT                    | Directorio de media
user_id         | TEXT                    | ID del usuario
input_tokens    | BIGINT                  | Tokens de entrada (user)
output_tokens   | BIGINT                  | Tokens de salida (assistant)
```

## 🔄 Mapeo de Datos

### De `kpi_data_sofia.conversations` a estructura normalizada:

| Campo Original | Destino | Transformación |
|----------------|---------|----------------|
| `chat_id` | `conversations.chat_id` | Directo (o `migrated_XXX` si NULL) |
| `message_content` | `messages.content` (role='user') | Mensaje del usuario |
| `response` | `messages.content` (role='assistant') | Respuesta del sistema |
| `input_token` | `messages.input_tokens` (role='user') | Solo en mensaje user |
| `output_token` | `messages.output_tokens` (role='assistant') | Solo en mensaje assistant |
| `user_channel` | `conversations.metadata->>'user_channel'` | Guardado en JSONB |
| `system_channel` | `conversations.metadata->>'system_channel'` | Guardado en JSONB |
| `file` | `messages.message_type` | 'document' si true, 'text' si false |

### Lógica de Separación

Cada registro original genera:
1. **1 conversación** (si es el primer mensaje de ese chat_id)
2. **1 mensaje de usuario** (si `message_content` no es NULL)
3. **1 mensaje de asistente** (si `response` no es NULL)

## ✅ Validaciones Automáticas

El script de validación verifica:

- ✓ Conteo de registros (original vs nuevo)
- ✓ Suma de tokens (debe coincidir)
- ✓ Integridad referencial (sin huérfanos)
- ✓ Distribución de roles
- ✓ Fechas consistentes
- ✓ Campos obligatorios no NULL
- ✓ Metadata correctamente poblada

## 🛡️ Seguridad y Rollback

### La tabla original NO se elimina

```sql
-- La tabla original se renombra a:
kpi_data_sofia.conversations_deprecated

-- Para rollback (antes de eliminar la deprecated):
DROP TABLE kpidata.conversations CASCADE;
DROP TABLE kpidata.messages CASCADE;
ALTER TABLE kpi_data_sofia.conversations_deprecated 
  RENAME TO conversations;
```

### Vista de Compatibilidad

Se crea automáticamente una vista con el nombre original:

```sql
-- Tu código antiguo seguirá funcionando
SELECT * FROM kpi_data_sofia.conversations;
-- → Esta vista mapea a las nuevas tablas
```

## 📝 Tareas Post-Migración

### 1. Actualizar Aplicación Web

Actualiza tus queries para usar las nuevas tablas:

```javascript
// Antes
const { data } = await supabase
  .from('kpi_data_sofia.conversations')
  .select('*');

// Después
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages (*)
  `);
```

### 2. Verificar Edge Functions

Revisa las funciones de Supabase que usen la tabla antigua:

```bash
# Buscar referencias
grep -r "kpi_data_sofia.conversations" supabase/functions/
```

### 3. Actualizar N8N Workflows

Si usas N8N con esta tabla, actualiza los nodos de Supabase.

### 4. Eliminar Tabla Deprecated (después de validar)

```sql
-- Solo después de confirmar que todo funciona
DROP TABLE kpi_data_sofia.conversations_deprecated;
```

## 🔍 Consultas Útiles Post-Migración

### Ver conversaciones con sus mensajes

```sql
SELECT 
  c.chat_id,
  c.title,
  c.created_at,
  m.role,
  m.content,
  m.tokens
FROM kpidata.conversations c
LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
WHERE c.chat_id = 'tu_chat_id'
ORDER BY m.created_at;
```

### Estadísticas de una conversación

```sql
SELECT * FROM kpidata.v_conversations_summary
WHERE chat_id = 'tu_chat_id';
```

### Top conversaciones por tokens

```sql
SELECT 
  c.chat_id,
  c.title,
  COUNT(m.id) as total_messages,
  SUM(m.tokens) as total_tokens
FROM kpidata.conversations c
LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
GROUP BY c.chat_id, c.title
ORDER BY total_tokens DESC
LIMIT 10;
```

## ⚠️ Notas Importantes

1. **Tiempo de ejecución**: Depende del volumen de datos. Prueba primero con un subset.

2. **Transacciones**: Los scripts usan transacciones implícitas. Para mayor control:
   ```sql
   BEGIN;
   \i 03_migrar_datos.sql
   -- Revisar resultados
   COMMIT; -- o ROLLBACK;
   ```

3. **Índices**: Se crean automáticamente para optimizar consultas comunes.

4. **Foreign Keys**: Si no existen las tablas `profiles` o `roles`, esas FKs no se crearán.

5. **Zona horaria**: Configurada para `America/Caracas` (UTC-4).

## 📞 Soporte

Para dudas o problemas:
1. Revisa los outputs de validación
2. Ejecuta `04_validacion_post_migracion.sql` nuevamente
3. Consulta los comentarios en cada script

---

**Última actualización**: 2025-12-29  
**Proyecto**: SestIA Reloaded - Fibex Telecom
