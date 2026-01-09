-- ════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN COMPLETA: kpi_data_sofia.conversations → kpidata (normalizado)
-- ════════════════════════════════════════════════════════════════════════════
-- Script maestro que ejecuta toda la migración en el orden correcto
-- 
-- AUTOR: GitHub Copilot
-- FECHA: 2025-12-29
-- PROYECTO: SestIA Reloaded - Fibex Telecom
-- 
-- ════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CONFIGURACIÓN INICIAL
-- ============================================================================

-- Establecer zona horaria para la sesión
SET timezone TO 'America/Caracas'; -- UTC-4

-- Mostrar inicio de migración
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  MIGRACIÓN DE BASE DE DATOS - SestIA Reloaded';
  RAISE NOTICE '  Inicio: %', now();
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 0: VERIFICACIÓN DE PREREQUISITOS
-- ============================================================================

DO $$
DECLARE
  v_exists BOOLEAN;
  v_count INTEGER;
BEGIN
  RAISE NOTICE '▶ PASO 0: Verificando prerequisitos...';
  
  -- Verificar que existe la tabla original
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'kpi_data_sofia' 
    AND table_name = 'conversations'
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'ERROR: No existe la tabla kpi_data_sofia.conversations';
  END IF;
  
  -- Verificar que tiene datos
  SELECT COUNT(*) INTO v_count FROM kpi_data_sofia.conversations;
  
  IF v_count = 0 THEN
    RAISE WARNING 'ADVERTENCIA: La tabla original está vacía';
  ELSE
    RAISE NOTICE '  ✓ Tabla original encontrada con % registros', v_count;
  END IF;
  
  -- Verificar que existen las tablas de referencia (si se necesitan las FK)
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'profiles'
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE WARNING '  ⚠ Tabla "profiles" no encontrada - Las FK a profiles no se crearán';
  END IF;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'roles'
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE WARNING '  ⚠ Tabla "roles" no encontrada - Las FK a roles no se crearán';
  END IF;
  
  RAISE NOTICE '  ✓ Prerequisitos verificados';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASO 1: ANÁLISIS DE DATOS ACTUALES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '▶ PASO 1: Analizando datos actuales...';
  RAISE NOTICE '  (Para ver detalles completos, ejecuta: 01_analisis_datos_actuales.sql)';
END $$;

-- Análisis rápido
SELECT 
  'Total registros' as metrica,
  COUNT(*)::text as valor
FROM kpi_data_sofia.conversations
UNION ALL
SELECT 
  'Conversaciones únicas',
  COUNT(DISTINCT chat_id)::text
FROM kpi_data_sofia.conversations
UNION ALL
SELECT 
  'Registros con chat_id NULL',
  COUNT(*)::text
FROM kpi_data_sofia.conversations
WHERE chat_id IS NULL;

RAISE NOTICE '';

-- ============================================================================
-- PASO 2: CREAR ESTRUCTURA NUEVA
-- ============================================================================

\echo '▶ PASO 2: Creando estructura normalizada...'
\i 02_crear_nuevas_tablas.sql
\echo '  ✓ Estructura creada'
\echo ''

-- ============================================================================
-- PASO 3: MIGRAR DATOS
-- ============================================================================

\echo '▶ PASO 3: Migrando datos...'
\i 03_migrar_datos.sql
\echo '  ✓ Datos migrados'
\echo ''

-- ============================================================================
-- PASO 4: VALIDAR MIGRACIÓN
-- ============================================================================

\echo '▶ PASO 4: Validando migración...'
\i 04_validacion_post_migracion.sql
\echo ''

-- ============================================================================
-- PASO 5: ACCIONES POST-MIGRACIÓN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '▶ PASO 5: Acciones post-migración...';
END $$;

-- Renombrar tabla antigua (backup)
DO $$
BEGIN
  -- Verificar si ya existe la tabla de backup
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'kpi_data_sofia' 
    AND table_name = 'conversations_deprecated'
  ) THEN
    RAISE NOTICE '  ⚠ Ya existe conversations_deprecated - Eliminándola...';
    DROP TABLE kpi_data_sofia.conversations_deprecated;
  END IF;
  
  -- Renombrar la tabla original
  ALTER TABLE kpi_data_sofia.conversations 
    RENAME TO conversations_deprecated;
  
  RAISE NOTICE '  ✓ Tabla original renombrada a: kpi_data_sofia.conversations_deprecated';
END $$;

-- Crear vista de compatibilidad (opcional)
CREATE OR REPLACE VIEW kpi_data_sofia.conversations AS
SELECT 
  m.id,
  m.created_at,
  m.user_id,
  m.chat_id,
  NULL::text as message_id,
  CASE WHEN m.role = 'user' THEN m.content ELSE NULL END as message_content,
  (
    SELECT m2.content 
    FROM kpidata.messages m2 
    WHERE m2.chat_id = m.chat_id 
    AND m2.role = 'assistant' 
    AND m2.created_at > m.created_at 
    ORDER BY m2.created_at ASC 
    LIMIT 1
  ) as response,
  m.input_tokens as input_token,
  (
    SELECT m2.output_tokens 
    FROM kpidata.messages m2 
    WHERE m2.chat_id = m.chat_id 
    AND m2.role = 'assistant' 
    AND m2.created_at > m.created_at 
    ORDER BY m2.created_at ASC 
    LIMIT 1
  ) as output_token,
  m.tokens,
  c.metadata->>'user_channel' as user_channel,
  c.metadata->>'system_channel' as system_channel,
  CASE WHEN m.message_type != 'text' THEN true ELSE false END as file
FROM kpidata.messages m
INNER JOIN kpidata.conversations c ON m.chat_id = c.chat_id
WHERE m.role = 'user';

COMMENT ON VIEW kpi_data_sofia.conversations IS 
  'Vista de compatibilidad para consultas antiguas. Mapea la nueva estructura normalizada al formato anterior.';

RAISE NOTICE '  ✓ Vista de compatibilidad creada: kpi_data_sofia.conversations';
RAISE NOTICE '';

-- ============================================================================
-- PASO 6: CONFIGURAR PERMISOS (Ajustar según tu configuración)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '▶ PASO 6: Configurando permisos...';
  RAISE NOTICE '  ⚠ Revisar y descomentar las líneas de permisos según tu configuración';
  RAISE NOTICE '';
  
  -- Descomentar según necesites:
  -- GRANT SELECT, INSERT, UPDATE, DELETE ON kpidata.conversations TO authenticated;
  -- GRANT SELECT, INSERT, UPDATE, DELETE ON kpidata.messages TO authenticated;
  -- GRANT USAGE, SELECT ON SEQUENCE kpidata.messages_id_seq TO authenticated;
  -- GRANT SELECT ON kpidata.v_conversations_summary TO authenticated;
END $$;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

DO $$
DECLARE
  v_original INTEGER;
  v_conversations INTEGER;
  v_messages INTEGER;
  v_ratio NUMERIC;
BEGIN
  -- Obtener conteos
  SELECT COUNT(*) INTO v_original FROM kpi_data_sofia.conversations_deprecated;
  SELECT COUNT(*) INTO v_conversations FROM kpidata.conversations;
  SELECT COUNT(*) INTO v_messages FROM kpidata.messages;
  v_ratio := ROUND(v_messages::numeric / NULLIF(v_conversations, 0), 2);
  
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  MIGRACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTADÍSTICAS:';
  RAISE NOTICE '   • Registros originales: %', v_original;
  RAISE NOTICE '   • Conversaciones creadas: %', v_conversations;
  RAISE NOTICE '   • Mensajes creados: %', v_messages;
  RAISE NOTICE '   • Promedio mensajes/conversación: %', v_ratio;
  RAISE NOTICE '';
  RAISE NOTICE '📁 ESTRUCTURA:';
  RAISE NOTICE '   • Tabla nueva: kpidata.conversations';
  RAISE NOTICE '   • Tabla nueva: kpidata.messages';
  RAISE NOTICE '   • Vista: kpidata.v_conversations_summary';
  RAISE NOTICE '   • Backup: kpi_data_sofia.conversations_deprecated';
  RAISE NOTICE '   • Vista compatibilidad: kpi_data_sofia.conversations (nueva)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ PRÓXIMOS PASOS:';
  RAISE NOTICE '   1. Revisar los resultados de validación arriba';
  RAISE NOTICE '   2. Probar queries desde tu aplicación';
  RAISE NOTICE '   3. Actualizar código para usar las nuevas tablas';
  RAISE NOTICE '   4. Después de validar, eliminar: conversations_deprecated';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '   • La tabla original está en: conversations_deprecated';
  RAISE NOTICE '   • Se creó una vista de compatibilidad con el mismo nombre';
  RAISE NOTICE '   • Actualiza tu aplicación para usar kpidata.* directamente';
  RAISE NOTICE '';
  RAISE NOTICE '  Finalización: %', now();
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
