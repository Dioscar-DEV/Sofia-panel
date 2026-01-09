-- =====================================================
-- FIX PARA ASIGNACIÓN DE REPORTES
-- =====================================================
-- Este script crea una función RPC para asignar usuarios a reportes
-- en el esquema kpi_data_sofia y configura los permisos necesarios

-- 1. Crear función RPC para asignar usuario a reporte
CREATE OR REPLACE FUNCTION public.asignar_usuario_reporte(
  p_reporte_id BIGINT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result INTEGER;
BEGIN
  -- Actualizar el reporte en kpi_data_sofia
  UPDATE kpi_data_sofia.reportes
  SET user_id = p_user_id
  WHERE id = p_reporte_id;
  
  GET DIAGNOSTICS v_result = ROW_COUNT;
  
  IF v_result = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reporte no encontrado'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'id', p_reporte_id,
    'user_id', p_user_id
  );
END;
$$;

-- 2. Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.asignar_usuario_reporte(BIGINT, UUID) TO authenticated;

-- 3. Asegurar que el esquema kpi_data_sofia tenga los permisos necesarios
GRANT USAGE ON SCHEMA kpi_data_sofia TO authenticated, service_role;
GRANT SELECT, UPDATE ON kpi_data_sofia.reportes TO authenticated, service_role;

-- 4. Deshabilitar RLS temporalmente en kpi_data_sofia.reportes (si está habilitado)
-- o crear políticas permisivas
DO $$
BEGIN
  -- Verificar si RLS está habilitado
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'kpi_data_sofia' 
    AND tablename = 'reportes' 
    AND rowsecurity = true
  ) THEN
    -- Si RLS está habilitado, crear políticas permisivas para operaciones básicas
    
    -- Política para SELECT
    DROP POLICY IF EXISTS "Allow authenticated users to view reportes" ON kpi_data_sofia.reportes;
    CREATE POLICY "Allow authenticated users to view reportes" 
      ON kpi_data_sofia.reportes
      FOR SELECT
      TO authenticated
      USING (true);
    
    -- Política para UPDATE (solo service_role y funciones SECURITY DEFINER)
    DROP POLICY IF EXISTS "Allow service_role to update reportes" ON kpi_data_sofia.reportes;
    CREATE POLICY "Allow service_role to update reportes"
      ON kpi_data_sofia.reportes
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Comentario en la función
COMMENT ON FUNCTION public.asignar_usuario_reporte IS 'Asigna un usuario a un reporte en kpi_data_sofia.reportes con bypass de RLS';

-- =====================================================
-- INSTRUCCIONES
-- =====================================================
-- 1. Ejecuta este script completo en el SQL Editor de Supabase
-- 2. Verifica que la función se haya creado: SELECT proname FROM pg_proc WHERE proname = 'asignar_usuario_reporte';
-- 3. El código del frontend ya debe estar ajustado para usar esta función RPC
