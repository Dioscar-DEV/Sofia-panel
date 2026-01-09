-- ============================================
-- RPC: get_notifications
-- ============================================
-- Descripción: Obtiene las notificaciones del usuario autenticado
-- Autor: Sistema de Notificaciones
-- Fecha: 2024
-- ============================================

CREATE OR REPLACE FUNCTION public.get_notifications(
  p_limit INTEGER DEFAULT 50,
  p_unread_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  read BOOLEAN,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Obtener el ID del usuario autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Retornar las notificaciones del usuario
  RETURN QUERY
  SELECT
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.link,
    n.read,
    n.created_at,
    n.read_at,
    n.metadata
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND (NOT p_unread_only OR n.read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- PERMISOS
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_notifications(INTEGER, BOOLEAN) TO authenticated;

-- ============================================
-- NOTAS DE USO
-- ============================================
-- Parámetros:
--   p_limit: Número máximo de notificaciones a retornar (default: 50)
--   p_unread_only: Si es true, solo retorna notificaciones no leídas (default: false)
--
-- Ejemplo de uso en JavaScript:
--   const { data, error } = await supabase.rpc('get_notifications', {
--     p_limit: 100,
--     p_unread_only: true
--   });
--
-- Retorna:
--   Array de objetos con la estructura de la tabla 'notifications'
--
-- Seguridad:
--   - SECURITY DEFINER: Se ejecuta con los permisos del creador de la función
--   - Valida que el usuario esté autenticado (auth.uid() no null)
--   - Filtra automáticamente por el user_id del usuario autenticado
--   - Solo retorna notificaciones del usuario actual (RLS implícito)
