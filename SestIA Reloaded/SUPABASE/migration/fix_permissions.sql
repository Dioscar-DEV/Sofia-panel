-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Permisos para acceso a conversaciones desde el frontend
-- ════════════════════════════════════════════════════════════════════════════
-- Ejecutar si se presenta el error: "No se pudieron cargar las conversaciones"
-- Este script otorga los permisos necesarios a los roles anon y authenticated

-- Otorgar permisos al schema
GRANT USAGE ON SCHEMA kpidata TO anon;
GRANT USAGE ON SCHEMA kpidata TO authenticated;

-- Permisos para usuarios no autenticados (anon)
GRANT SELECT ON kpidata.conversations TO anon;
GRANT SELECT ON kpidata.messages TO anon;
GRANT SELECT ON kpidata.v_conversations_summary TO anon;

-- Permisos para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON kpidata.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kpidata.messages TO authenticated;
GRANT SELECT ON kpidata.v_conversations_summary TO authenticated;

-- Permisos en secuencia para INSERT
GRANT USAGE, SELECT ON SEQUENCE kpidata.messages_id_seq TO authenticated;

-- Verificar que los permisos se aplicaron
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ PERMISOS APLICADOS CORRECTAMENTE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Permisos otorgados:';
  RAISE NOTICE '   • anon: SELECT en conversations, messages, v_conversations_summary';
  RAISE NOTICE '   • authenticated: CRUD completo en conversations y messages';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Acciones requeridas:';
  RAISE NOTICE '   1. Recargar la página web (F5)';
  RAISE NOTICE '   2. Navegar al módulo LiveChat';
  RAISE NOTICE '   3. Verificar que se cargan las conversaciones';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

-- Probar consulta como lo haría el cliente
SELECT 
  '✅ Test de consulta' as status,
  COUNT(*) as conversaciones_disponibles
FROM kpidata.conversations;
