-- ============================================================================
-- VALIDACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Ejecutar este script después de la migración para verificar integridad
-- y consistencia de datos

-- ============================================================================
-- 1. COMPARACIÓN DE CONTEOS
-- ============================================================================

SELECT 
  'ORIGINAL: Total registros' as descripcion,
  COUNT(*)::text as valor
FROM kpi_data_sofia.conversations

UNION ALL

SELECT 
  'NUEVO: Total conversaciones',
  COUNT(*)::text
FROM kpidata.conversations

UNION ALL

SELECT 
  'NUEVO: Total mensajes',
  COUNT(*)::text
FROM kpidata.messages

UNION ALL

SELECT 
  'ESPERADO: Mensajes (debería ser ~2x original si cada registro tenía mensaje+respuesta)',
  (COUNT(*) * 2)::text
FROM kpi_data_sofia.conversations
WHERE message_content IS NOT NULL AND response IS NOT NULL;

-- ============================================================================
-- 2. VALIDACIÓN DE TOKENS
-- ============================================================================

-- Comparar suma de tokens
WITH original_tokens AS (
  SELECT 
    SUM(COALESCE(input_token, 0)) as total_input,
    SUM(COALESCE(output_token, 0)) as total_output,
    SUM(COALESCE(tokens, 0)) as total_general,
    SUM(COALESCE(input_token, 0) + COALESCE(output_token, 0) + COALESCE(tokens, 0)) as total_combinado
  FROM kpi_data_sofia.conversations
),
new_tokens AS (
  SELECT 
    SUM(COALESCE(input_tokens, 0)) as total_input,
    SUM(COALESCE(output_tokens, 0)) as total_output,
    SUM(COALESCE(tokens, 0)) as total_general
  FROM kpidata.messages
)
SELECT 
  'TOKENS - Original Input' as metrica,
  o.total_input::text as original,
  n.total_input::text as nuevo,
  CASE 
    WHEN o.total_input = n.total_input THEN '✓ OK'
    ELSE '⚠ DIFERENCIA'
  END as status
FROM original_tokens o, new_tokens n

UNION ALL

SELECT 
  'TOKENS - Original Output',
  o.total_output::text,
  n.total_output::text,
  CASE 
    WHEN o.total_output = n.total_output THEN '✓ OK'
    ELSE '⚠ DIFERENCIA'
  END
FROM original_tokens o, new_tokens n

UNION ALL

SELECT 
  'TOKENS - Total General',
  o.total_combinado::text,
  n.total_general::text,
  CASE 
    WHEN ABS(o.total_combinado - n.total_general) < 100 THEN '✓ OK'
    ELSE '⚠ REVISAR'
  END
FROM original_tokens o, new_tokens n;

-- ============================================================================
-- 3. INTEGRIDAD REFERENCIAL
-- ============================================================================

-- Verificar que no hay mensajes huérfanos
SELECT 
  'Mensajes sin conversación (huérfanos)' as validacion,
  COUNT(*)::text as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '✗ ERROR'
  END as status
FROM kpidata.messages m
LEFT JOIN kpidata.conversations c ON m.chat_id = c.chat_id
WHERE c.chat_id IS NULL

UNION ALL

-- Verificar que no hay conversaciones sin mensajes
SELECT 
  'Conversaciones sin mensajes',
  COUNT(*)::text,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '⚠ ADVERTENCIA'
  END
FROM kpidata.conversations c
LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
WHERE m.id IS NULL;

-- ============================================================================
-- 4. VALIDACIÓN DE DATOS ESPECÍFICOS
-- ============================================================================

-- Verificar distribución de roles en mensajes
SELECT 
  'Distribución de roles' as categoria,
  role,
  COUNT(*) as cantidad,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)::text || '%' as porcentaje
FROM kpidata.messages
GROUP BY role
ORDER BY cantidad DESC;

-- ============================================================================
-- 5. VALIDACIÓN DE FECHAS
-- ============================================================================

-- Verificar que las fechas tienen sentido
SELECT 
  'Validación de fechas' as validacion,
  'Conversaciones con created_at > updated_at' as descripcion,
  COUNT(*)::text as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '⚠ REVISAR'
  END as status
FROM kpidata.conversations
WHERE created_at > updated_at

UNION ALL

SELECT 
  'Validación de fechas',
  'Mensajes con fecha futura',
  COUNT(*)::text,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '⚠ REVISAR'
  END
FROM kpidata.messages
WHERE created_at > now();

-- ============================================================================
-- 6. VALIDACIÓN DE CAMPOS OBLIGATORIOS
-- ============================================================================

SELECT 
  'Campos NULL en messages' as categoria,
  'chat_id NULL' as campo,
  COUNT(*)::text as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '✗ ERROR CRÍTICO'
  END as status
FROM kpidata.messages
WHERE chat_id IS NULL

UNION ALL

SELECT 
  'Campos NULL en messages',
  'user_id NULL',
  COUNT(*)::text,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '⚠ REVISAR'
  END
FROM kpidata.messages
WHERE user_id IS NULL

UNION ALL

SELECT 
  'Campos NULL en messages',
  'role NULL',
  COUNT(*)::text,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ OK'
    ELSE '✗ ERROR CRÍTICO'
  END
FROM kpidata.messages
WHERE role IS NULL;

-- ============================================================================
-- 7. MUESTREO DE DATOS (10 conversaciones aleatorias)
-- ============================================================================

SELECT 
  c.chat_id,
  c.title,
  c.created_at,
  COUNT(m.id) as total_mensajes,
  SUM(COALESCE(m.tokens, 0)) as total_tokens,
  MAX(m.created_at) as ultimo_mensaje
FROM kpidata.conversations c
LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
GROUP BY c.chat_id, c.title, c.created_at
ORDER BY RANDOM()
LIMIT 10;

-- ============================================================================
-- 8. VERIFICACIÓN DE METADATA
-- ============================================================================

-- Verificar que metadata tiene los campos esperados
SELECT 
  'Metadata - Campos presentes' as validacion,
  CASE 
    WHEN metadata ? 'original_schema' THEN '✓ original_schema'
    ELSE '✗ original_schema faltante'
  END as campo1,
  CASE 
    WHEN metadata ? 'migrated_at' THEN '✓ migrated_at'
    ELSE '✗ migrated_at faltante'
  END as campo2,
  CASE 
    WHEN metadata ? 'user_channel' THEN '✓ user_channel'
    ELSE '⚠ user_channel faltante'
  END as campo3
FROM kpidata.conversations
LIMIT 1;

-- ============================================================================
-- 9. ESTADÍSTICAS COMPARATIVAS
-- ============================================================================

-- Chat con más mensajes (original vs nuevo)
WITH original_top AS (
  SELECT 
    chat_id,
    COUNT(*) as msg_count
  FROM kpi_data_sofia.conversations
  WHERE chat_id IS NOT NULL
  GROUP BY chat_id
  ORDER BY msg_count DESC
  LIMIT 1
),
new_top AS (
  SELECT 
    c.chat_id,
    COUNT(m.id) as msg_count
  FROM kpidata.conversations c
  LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
  GROUP BY c.chat_id
  ORDER BY msg_count DESC
  LIMIT 1
)
SELECT 
  'Chat con más mensajes' as metrica,
  o.chat_id as original_chat_id,
  o.msg_count as original_count,
  n.chat_id as nuevo_chat_id,
  n.msg_count as nuevo_count
FROM original_top o, new_top n;

-- ============================================================================
-- 10. RESUMEN FINAL
-- ============================================================================

DO $$
DECLARE
  v_conversations INTEGER;
  v_messages INTEGER;
  v_errors INTEGER := 0;
  v_warnings INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_conversations FROM kpidata.conversations;
  SELECT COUNT(*) INTO v_messages FROM kpidata.messages;
  
  -- Contar errores críticos
  SELECT COUNT(*) INTO v_errors
  FROM kpidata.messages
  WHERE chat_id IS NULL OR role IS NULL;
  
  -- Contar advertencias
  SELECT COUNT(*) INTO v_warnings
  FROM kpidata.conversations c
  LEFT JOIN kpidata.messages m ON c.chat_id = m.chat_id
  WHERE m.id IS NULL;
  
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'RESUMEN DE VALIDACIÓN';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'Total conversaciones: %', v_conversations;
  RAISE NOTICE 'Total mensajes: %', v_messages;
  RAISE NOTICE 'Errores críticos: %', v_errors;
  RAISE NOTICE 'Advertencias: %', v_warnings;
  RAISE NOTICE '';
  
  IF v_errors = 0 AND v_warnings = 0 THEN
    RAISE NOTICE '✓ MIGRACIÓN EXITOSA - Sin errores detectados';
  ELSIF v_errors > 0 THEN
    RAISE WARNING '✗ MIGRACIÓN CON ERRORES - Revisar datos críticos';
  ELSE
    RAISE NOTICE '⚠ MIGRACIÓN COMPLETADA - Revisar advertencias';
  END IF;
  
  RAISE NOTICE '════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- CONSULTAS ADICIONALES ÚTILES (comentadas, ejecutar según necesidad)
-- ============================================================================

-- Ver conversaciones con problemas
-- SELECT * FROM kpidata.conversations 
-- WHERE created_at > updated_at OR user_assign IS NULL;

-- Ver mensajes de una conversación específica
-- SELECT * FROM kpidata.messages 
-- WHERE chat_id = 'TU_CHAT_ID' 
-- ORDER BY created_at;

-- Ver distribución de canales (desde metadata)
-- SELECT 
--   metadata->>'user_channel' as canal,
--   COUNT(*) as cantidad
-- FROM kpidata.conversations
-- GROUP BY metadata->>'user_channel'
-- ORDER BY cantidad DESC;
