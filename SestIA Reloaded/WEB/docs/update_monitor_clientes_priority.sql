-- ============================================
-- ACTUALIZACIÓN: Agregar score de prioridad
-- ============================================
-- Esta migración actualiza el RPC list_monitor_clientes
-- para incluir un campo priority_score que combina:
-- - Urgencia (peso x2)
-- - Sentimiento (enojado +20)
-- - Intención (reclamo/queja +10)
-- ============================================

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
    k.user_id,
    k.contact_id,
    k.contact_name,
    k.sentimiento,
    k.intencion,
    k.resumen,
    k.puntuacion_urgencia,
    k.nivel_urgencia,
    k.canal_origen,
    k.estado,
    k.tiene_conversacion,
    k.assigned_user_id,
    k.assigned_user_name,
    k.created_at,
    k.update_at,
    -- Calcular score de prioridad
    (
      -- Base: urgencia * 2
      (COALESCE(k.puntuacion_urgencia, 0) * 2) +

      -- +20 si el cliente está enojado
      CASE
        WHEN k.sentimiento IS NOT NULL
          AND LOWER(k.sentimiento) LIKE '%enoj%'
        THEN 20
        ELSE 0
      END +

      -- +10 si es un reclamo o queja
      CASE
        WHEN k.intencion IS NOT NULL
          AND (
            LOWER(k.intencion) LIKE '%reclam%'
            OR LOWER(k.intencion) LIKE '%quej%'
          )
        THEN 10
        ELSE 0
      END
    )::INTEGER AS priority_score
  FROM (
    -- Aquí va la consulta base existente del RPC
    -- NOTA: Esta parte debe ajustarse según la implementación actual
    -- Esta es una estructura de ejemplo que debe completarse con la lógica real
    SELECT DISTINCT ON (mk.user_id)
      mk.user_id,
      mk.contact_id,
      mk.contact_name,
      mk.sentimiento,
      mk.intencion,
      mk.resumen,
      mk.puntuacion_urgencia,
      mk.nivel_urgencia,
      mk.canal_origen,
      mk.estado,
      (mk.contact_id IS NOT NULL) AS tiene_conversacion,
      ca.user_id AS assigned_user_id,
      p.name AS assigned_user_name,
      mk.created_at,
      mk.update_at
    FROM kpidata.monitor_kpi mk
    LEFT JOIN public.conversation_assignments ca
      ON mk.contact_id = ca.contact_id
      AND ca.is_active = true
    LEFT JOIN public.profiles p
      ON ca.user_id = p.user_id
    WHERE mk.estado != 'resuelto'
      OR mk.estado IS NULL
    ORDER BY mk.user_id, mk.update_at DESC
  ) k
  ORDER BY
    -- Ordenar por score de prioridad descendente
    priority_score DESC,
    -- Luego por fecha de actualización (más reciente primero)
    k.update_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Comentario explicativo sobre el score
COMMENT ON FUNCTION kpidata.list_monitor_clientes IS
'Lista clientes del monitor con score de prioridad calculado.
Score = (urgencia * 2) + (enojado: +20) + (reclamo: +10)
Ordenado por prioridad descendente.';

GRANT EXECUTE ON FUNCTION kpidata.list_monitor_clientes(INTEGER, INTEGER) TO authenticated;
