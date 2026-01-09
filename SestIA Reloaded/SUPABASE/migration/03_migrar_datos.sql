-- ============================================================================
-- MIGRACIÓN DE DATOS: kpi_data_sofia.conversations → kpidata (normalizado)
-- ============================================================================
-- Este script migra los datos de la tabla monolítica a la estructura normalizada
-- IMPORTANTE: Ejecutar después de 01_analisis y 02_crear_nuevas_tablas

-- ============================================================================
-- PASO 1: MIGRAR CONVERSACIONES (agrupar por chat_id)
-- ============================================================================

-- Insertar conversaciones únicas con normalización de chat_id
INSERT INTO kpidata.conversations (
  chat_id,
  created_at,
  title,
  metadata,
  updated_at,
  user_assign,
  role_assign
)
SELECT DISTINCT ON (normalized_chat_id)
  -- Normalizar chat_id: remover sufijo @s.whatsapp.net para unificar duplicados
  CASE
    WHEN chat_id IS NULL THEN 'migrated_' || id::text
    ELSE REPLACE(chat_id, '@s.whatsapp.net', '')
  END as chat_id,
  
  -- Fecha de creación = primer mensaje de ese chat
  created_at,
  
  -- Título basado en el primer mensaje (primeros 50 caracteres)
  COALESCE(
    LEFT(message_content, 50),
    'Conversación sin título'
  ) as title,
  
  -- Metadata: guardar información del canal y otros datos
  jsonb_build_object(
    'original_schema', 'kpi_data_sofia',
    'user_channel', user_channel,
    'system_channel', system_channel,
    'has_files', BOOL_OR(COALESCE(file, false)) OVER (PARTITION BY REPLACE(COALESCE(chat_id, 'migrated_' || id::text), '@s.whatsapp.net', '')),
    'migrated_at', now(),
    'total_messages_at_migration', COUNT(*) OVER (PARTITION BY REPLACE(COALESCE(chat_id, 'migrated_' || id::text), '@s.whatsapp.net', '')),
    'original_chat_id_format', chat_id
  ) as metadata,
  
  -- updated_at = último mensaje de ese chat
  MAX(created_at) OVER (PARTITION BY REPLACE(COALESCE(chat_id, 'migrated_' || id::text), '@s.whatsapp.net', '')) as updated_at,
  
  -- user_assign: convertir user_id a UUID si es posible, NULL si no
  CASE 
    WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN user_id::uuid
    ELSE NULL
  END as user_assign,
  
  -- role_assign: NULL por ahora (se puede actualizar después)
  NULL as role_assign
  
FROM kpi_data_sofia.conversations
WHERE chanormalized_chat_id, created_at ASC;

-- Nota: Se usa DISTINCT ON (normalized_chat_id) para que si existen
-- tanto "584122871080" como "584122871080@s.whatsapp.net", 
-- solo se cree UNA conversación con el formato normalizadoS NOT NULL
ORDER BY chat_id, created_at ASC;

-- Mensaje de progreso
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM kpidata.conversations;
  RAISE NOTICE 'PASO 1 COMPLETADO: % conversaciones migradas', v_count;
END $$;

-- ============================================================================
-- PASO 2: MIGRAR MENSAJES (mensaje del usuario + respuesta del sistema)
-- ============================================================================

-- Primero: Insertar mensajes del USUARIO (message_content)
INSERT INTO kpidata.messages (
  created_at,
  role,
  content,
  message_type,
  media_url,
  tokens,
  chat_id,
  media_id,
  media_directory,
  user_id,
  input_tokens,
  CASE 
    WHEN message_content IS NULL THEN 'system'  -- Mensajes sin contenido = sistema
    ELSE 'user'
  END as role,
  COALESCE(message_content, '[mensaje del sistema]') as content,
  CASE 
    WHEN file = true THEN 'document'
    ELSE 'text'
  END as message_type,
  NULL as media_url,
  COALESCE(input_token, 0) as tokens,
  REPLACE(COALESCE(chat_id, 'migrated_' || id::text), '@s.whatsapp.net', '') as chat_id,
  NULL as media_id,
  NULL as media_directory,
  COALESCE(user_id, 'unknown') as user_id,
  input_token,
  NULL as output_tokens
FROM kpi_data_sofia.conversations user_id,
  input_token,
  NULL as output_tokens
FROM kpi_data_sofia.conversations
WHERE message_content IS NOT NULL;

-- Mensaje de progreso
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM kpidata.messages WHERE role = 'user';
  RAISE NOTICE 'Mensajes de usuario migrados: %', v_count;
END $$;

-- Segundo: Insertar RESPUESTAS del sistema/asistente
INSERT INTO kpidata.messages (
  created_at,
  role,
  content,
  message_type,
  media_url,
  tokens,
  chat_id,
  media_id,
  media_directory,
  user_id,
  input_tokens,
  output_tokens
)
SELECT 
  -- Añadir 1 segundo a created_at para que la respuesta sea posterior
  REPLACE(COALESCE(chat_id, 'migrated_' || id::text), '@s.whatsapp.net', ''
  'assistant' as role,  -- Respuesta del asistente
  response as content,
  'text' as message_type,
  NULL as media_url,
  COALESCE(output_token, 0) as tokens,
  COALESCE(chat_id, 'migrated_' || id::text) as chat_id,
  NULL as media_id,
  NULL as media_directory,
  'sofia_system' as user_id,  -- ID del sistema
  NULL as input_tokens,
  output_token
FROM kpi_data_sofia.conversations
WHERE response IS NOT NULL;

-- Mensaje de progreso
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM kpidata.messages WHERE role = 'assistant';
  RAISE NOTICE 'Mensajes de asistente migrados: %', v_count;
END $$;

-- ============================================================================
-- PASO 3: ACTUALIZAR updated_at en conversaciones
-- ============================================================================
-- El trigger debería hacerlo, pero por si acaso actualizamos manualmente

UPDATE kpidata.conversations c
SET updated_at = (
  SELECT MAX(created_at)
  FROM kpidata.messages m
  WHERE m.chat_id = c.chat_id
);

-- ============================================================================
-- PASO 4: VERIFICACIÓN DE INTEGRIDAD
-- ============================================================================

-- Verificar que todas las conversaciones tienen mensajes
DO $$
DECLARE
  v_sin_mensajes INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sin_mensajes
  FROM kpidata.conversations c
  LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
  WHERE m.id IS NULL;
  
  IF v_sin_mensajes > 0 THEN
    RAISE WARNING 'ATENCIÓN: % conversaciones sin mensajes', v_sin_mensajes;
  ELSE
    RAISE NOTICE 'VERIFICACIÓN OK: Todas las conversaciones tienen mensajes';
  END IF;
END $$;

-- Verificar que todos los mensajes tienen conversación válida
DO $$
DECLARE
  v_huerfanos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_huerfanos
  FROM kpidata.messages m
  LEFT JOIN kpidata.conversations c ON m.chat_id = c.chat_id
  WHERE c.chat_id IS NULL;
  
  IF v_huerfanos > 0 THEN
    RAISE ERROR 'ERROR CRÍTICO: % mensajes sin conversación asociada', v_huerfanos;
  ELSE
    RAISE NOTICE 'VERIFICACIÓN OK: Todos los mensajes tienen conversación válida';
  END IF;
END $$;

-- ============================================================================
-- RESUMEN DE MIGRACIÓN
-- ============================================================================

DO $$
DECLARE
  v_orig_total INTEGER;
  v_new_conversations INTEGER;
  v_new_messages INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orig_total FROM kpi_data_sofia.conversations;
  SELECT COUNT(*) INTO v_new_conversations FROM kpidata.conversations;
  SELECT COUNT(*) INTO v_new_messages FROM kpidata.messages;
  
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'RESUMEN DE MIGRACIÓN';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'Registros originales: %', v_orig_total;
  RAISE NOTICE 'Conversaciones creadas: %', v_new_conversations;
  RAISE NOTICE 'Mensajes creados: %', v_new_messages;
  RAISE NOTICE 'Ratio mensajes/conversación: %', ROUND(v_new_messages::numeric / v_new_conversations, 2);
  RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 1. Los chat_id NULL se convierten en 'migrated_XXX' donde XXX es el id original
-- 2. Los mensajes y respuestas se separan en registros diferentes
-- 3. Los tokens se distribuyen: input_tokens al mensaje user, output_tokens al assistant
-- 4. La metadata guarda información del canal original para referencia
-- 5. Las conversaciones sin user_id válido quedan con user_assign NULL
