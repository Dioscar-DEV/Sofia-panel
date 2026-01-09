-- ============================================
-- WRAPPER: Agregar priority_score a list_monitor_clientes
-- ============================================
-- Esta solución crea un RPC wrapper que toma los resultados
-- del RPC existente y agrega el campo priority_score
-- ============================================

-- OPCIÓN 1: Modificar el RPC existente directamente
-- Ejecuta esto si quieres actualizar el RPC actual

CREATE OR REPLACE FUNCTION kpidata.list_monitor_clientes_with_priority(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id TEXT,
  contact_id UUID,
  contact_name TEXT,
  sentimiento TEXT,
  intencion TEXT,
  resumen TEXT,
  puntuacion_urgencia INTEGER,
  nivel_urgencia TEXT,
  canal_origen TEXT,
  estado TEXT,
  tiene_conversacion BOOLEAN,
  assigned_user_id UUID,
  assigned_user_name TEXT,
  created_at TIMESTAMPTZ,
  update_at TIMESTAMPTZ,
  priority_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'kpidata', 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.*,
    -- Calcular priority_score
    (
      -- Base: urgencia * 2
      (COALESCE(c.puntuacion_urgencia, 0) * 2) +

      -- +20 si el cliente está enojado
      CASE
        WHEN c.sentimiento IS NOT NULL
          AND (
            LOWER(c.sentimiento) LIKE '%enoj%'
            OR LOWER(c.sentimiento) = 'enojado'
            OR LOWER(c.sentimiento) = 'molesto'
          )
        THEN 20
        ELSE 0
      END +

      -- +10 si es un reclamo o queja
      CASE
        WHEN c.intencion IS NOT NULL
          AND (
            LOWER(c.intencion) LIKE '%reclam%'
            OR LOWER(c.intencion) LIKE '%quej%'
          )
        THEN 10
        ELSE 0
      END
    )::INTEGER AS priority_score
  FROM kpidata.list_monitor_clientes(p_limit, p_offset) c
  ORDER BY
    -- Ordenar por score de prioridad descendente
    priority_score DESC,
    -- Luego por fecha de actualización
    c.update_at DESC;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION kpidata.list_monitor_clientes_with_priority(INTEGER, INTEGER) TO authenticated;

-- ============================================
-- WRAPPER para search_monitor_clientes
-- ============================================

CREATE OR REPLACE FUNCTION kpidata.search_monitor_clientes_with_priority(
  p_query TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id TEXT,
  contact_id UUID,
  contact_name TEXT,
  sentimiento TEXT,
  intencion TEXT,
  resumen TEXT,
  puntuacion_urgencia INTEGER,
  nivel_urgencia TEXT,
  canal_origen TEXT,
  estado TEXT,
  tiene_conversacion BOOLEAN,
  assigned_user_id UUID,
  assigned_user_name TEXT,
  created_at TIMESTAMPTZ,
  update_at TIMESTAMPTZ,
  priority_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'kpidata', 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.*,
    -- Calcular priority_score
    (
      (COALESCE(c.puntuacion_urgencia, 0) * 2) +
      CASE
        WHEN c.sentimiento IS NOT NULL
          AND (LOWER(c.sentimiento) LIKE '%enoj%' OR LOWER(c.sentimiento) = 'enojado')
        THEN 20
        ELSE 0
      END +
      CASE
        WHEN c.intencion IS NOT NULL
          AND (LOWER(c.intencion) LIKE '%reclam%' OR LOWER(c.intencion) LIKE '%quej%')
        THEN 10
        ELSE 0
      END
    )::INTEGER AS priority_score
  FROM kpidata.search_monitor_clientes(p_query, p_limit) c
  ORDER BY priority_score DESC, c.update_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION kpidata.search_monitor_clientes_with_priority(TEXT, INTEGER) TO authenticated;

-- ============================================
-- OPCIÓN 2: Reemplazar el RPC existente
-- ============================================
-- Si prefieres reemplazar el RPC actual en lugar de crear uno nuevo
-- Descomenta el siguiente bloque y comenta el anterior

/*
-- Primero, guarda el RPC original por si acaso
CREATE OR REPLACE FUNCTION kpidata.list_monitor_clientes_original(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id TEXT,
  contact_id UUID,
  contact_name TEXT,
  sentimiento TEXT,
  intencion TEXT,
  resumen TEXT,
  puntuacion_urgencia INTEGER,
  nivel_urgencia TEXT,
  canal_origen TEXT,
  estado TEXT,
  tiene_conversacion BOOLEAN,
  assigned_user_id UUID,
  assigned_user_name TEXT,
  created_at TIMESTAMPTZ,
  update_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'kpidata', 'public'
AS $$
BEGIN
  -- Copia aquí el código del RPC original
  RETURN QUERY SELECT * FROM kpidata.list_monitor_clientes(p_limit, p_offset);
END;
$$;

-- Ahora reemplaza el RPC original
CREATE OR REPLACE FUNCTION kpidata.list_monitor_clientes(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id TEXT,
  contact_id UUID,
  contact_name TEXT,
  sentimiento TEXT,
  intencion TEXT,
  resumen TEXT,
  puntuacion_urgencia INTEGER,
  nivel_urgencia TEXT,
  canal_origen TEXT,
  estado TEXT,
  tiene_conversacion BOOLEAN,
  assigned_user_id UUID,
  assigned_user_name TEXT,
  created_at TIMESTAMPTZ,
  update_at TIMESTAMPTZ,
  priority_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'kpidata', 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.*,
    (
      (COALESCE(c.puntuacion_urgencia, 0) * 2) +
      CASE WHEN c.sentimiento IS NOT NULL AND LOWER(c.sentimiento) LIKE '%enoj%' THEN 20 ELSE 0 END +
      CASE WHEN c.intencion IS NOT NULL AND (LOWER(c.intencion) LIKE '%reclam%' OR LOWER(c.intencion) LIKE '%quej%') THEN 10 ELSE 0 END
    )::INTEGER AS priority_score
  FROM kpidata.list_monitor_clientes_original(p_limit, p_offset) c
  ORDER BY priority_score DESC, c.update_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION kpidata.list_monitor_clientes(INTEGER, INTEGER) TO authenticated;
*/

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- 1. Ejecuta la OPCIÓN 1 (recomendado) para crear un nuevo RPC
-- 2. Luego actualiza el frontend para usar el nuevo nombre
-- 3. O ejecuta la OPCIÓN 2 para reemplazar el RPC existente (más arriesgado)
