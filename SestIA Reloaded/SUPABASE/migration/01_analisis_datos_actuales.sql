-- ============================================================================
-- ANÁLISIS DE DATOS ACTUALES EN kpi_data_sofia.conversations
-- ============================================================================
-- Este script analiza la estructura y calidad de datos antes de la migración
-- Ejecutar primero para entender el estado actual

-- 1. Conteo total de registros
SELECT 
  'Total registros' as metrica,
  COUNT(*) as valor
FROM kpi_data_sofia.conversations;

-- 2. Análisis de chat_id (conversaciones únicas)
SELECT 
  'Conversaciones únicas (chat_id distintos)' as metrica,
  COUNT(DISTINCT chat_id) as valor
FROM kpi_data_sofia.conversations;

-- 3. Análisis de valores nulos en campos clave
SELECT 
  'Registros con chat_id NULL' as campo,
  COUNT(*) as cantidad_nulls
FROM kpi_data_sofia.conversations
WHERE chat_id IS NULL

UNION ALL

SELECT 
  'Registros con user_id NULL',
  COUNT(*)
FROM kpi_data_sofia.conversations
WHERE user_id IS NULL

UNION ALL

SELECT 
  'Registros con message_content NULL',
  COUNT(*)
FROM kpi_data_sofia.conversations
WHERE message_content IS NULL

UNION ALL

SELECT 
  'Registros con response NULL',
  COUNT(*)
FROM kpi_data_sofia.conversations
WHERE response IS NULL;

-- 4. Distribución de mensajes por conversación
SELECT 
  'Promedio mensajes por chat' as metrica,
  ROUND(AVG(msg_count), 2) as valor
FROM (
  SELECT chat_id, COUNT(*) as msg_count
  FROM kpi_data_sofia.conversations
  WHERE chat_id IS NOT NULL
  GROUP BY chat_id
) sub;

-- 5. Conversaciones con más mensajes (Top 10)
SELECT 
  chat_id,
  COUNT(*) as total_mensajes,
  MIN(created_at) as primer_mensaje,
  MAX(created_at) as ultimo_mensaje,
  MAX(created_at) - MIN(created_at) as duracion
FROM kpi_data_sofia.conversations
WHERE chat_id IS NOT NULL
GROUP BY chat_id
ORDER BY total_mensajes DESC
LIMIT 10;

-- 6. Análisis de tokens
SELECT 
  'Total tokens consumidos' as metrica,
  SUM(COALESCE(tokens, 0) + COALESCE(input_token, 0) + COALESCE(output_token, 0)) as valor
FROM kpi_data_sofia.conversations;

-- 7. Análisis de canales
SELECT 
  user_channel,
  COUNT(*) as cantidad,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM kpi_data_sofia.conversations), 2) as porcentaje
FROM kpi_data_sofia.conversations
GROUP BY user_channel
ORDER BY cantidad DESC;

-- 8. Registros con archivos
SELECT 
  'Mensajes con archivos adjuntos' as metrica,
  COUNT(*) as valor
FROM kpi_data_sofia.conversations
WHERE file = true;

-- 9. Rango de fechas
SELECT 
  'Fecha más antigua' as metrica,
  MIN(created_at)::text as valor
FROM kpi_data_sofia.conversations

UNION ALL

SELECT 
  'Fecha más reciente',
  MAX(created_at)::text
FROM kpi_data_sofia.conversations;

-- 10. Identificar posibles problemas de datos
SELECT 
  'Registros problemáticos (chat_id NULL)' as problema,
  COUNT(*) as cantidad
FROM kpi_data_sofia.conversations
WHERE chat_id IS NULL

UNION ALL

SELECT 
  'Registros sin contenido (message_content y response NULL)',
  COUNT(*)
FROM kpi_data_sofia.conversations
WHERE message_content IS NULL AND response IS NULL;

-- ============================================================================
-- RECOMENDACIONES BASADAS EN EL ANÁLISIS
-- ============================================================================
-- Ejecuta este script y revisa los resultados antes de continuar
-- Presta atención especial a:
-- - Registros con chat_id NULL (necesitan generar un ID único)
-- - Registros sin contenido (decidir si migrar o descartar)
-- - Distribución de tokens (validar cálculos)
