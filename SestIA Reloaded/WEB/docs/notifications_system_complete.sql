-- ============================================
-- SISTEMA COMPLETO DE NOTIFICACIONES
-- ============================================
-- Este archivo contiene todas las tablas, funciones y triggers
-- necesarios para implementar el sistema de notificaciones
-- ============================================

-- ============================================
-- 1. TABLA: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'assignment', 'message', 'system', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL opcional a donde redirigir al hacer click
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  metadata JSONB -- Datos adicionales específicos del tipo de notificación
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Los usuarios solo pueden ver sus propias notificaciones
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. RPC: get_notifications
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_notifications(INTEGER, BOOLEAN) TO authenticated;

-- ============================================
-- 3. RPC: mark_notification_read
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.notifications
  SET
    read = true,
    read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read = false;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

-- ============================================
-- 4. RPC: mark_all_notifications_read
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.notifications
  SET
    read = true,
    read_at = NOW()
  WHERE user_id = auth.uid()
    AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ============================================
-- 5. TRIGGER: notify_on_assignment
-- ============================================
-- Este trigger crea una notificación cuando se asigna una conversación

CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contact_name TEXT;
BEGIN
  -- Obtener el nombre del contacto
  SELECT contact_name INTO v_contact_name
  FROM public.conversations
  WHERE contact_id = NEW.contact_id;

  -- Crear notificación para el usuario asignado
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.user_id,
    'assignment',
    'Nueva conversación asignada',
    'Se te ha asignado la conversación con ' || COALESCE(v_contact_name, 'un cliente'),
    '/livechat?contact=' || NEW.contact_id,
    jsonb_build_object(
      'contact_id', NEW.contact_id,
      'contact_name', v_contact_name,
      'assigned_at', NEW.assigned_at
    )
  );

  RETURN NEW;
END;
$$;

-- Crear el trigger en la tabla conversation_assignments
DROP TRIGGER IF EXISTS trigger_notify_on_assignment ON public.conversation_assignments;
CREATE TRIGGER trigger_notify_on_assignment
  AFTER INSERT ON public.conversation_assignments
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.notify_on_assignment();

-- ============================================
-- HABILITAR REALTIME PARA NOTIFICACIONES
-- ============================================
-- Esto permite que el frontend reciba notificaciones en tiempo real

-- Ejecuta esto en el dashboard de Supabase > Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================
-- EJEMPLOS DE USO
-- ============================================

-- JavaScript - Obtener todas las notificaciones
/*
const { data, error } = await supabase.rpc('get_notifications', {
  p_limit: 50,
  p_unread_only: false
});
*/

-- JavaScript - Obtener solo no leídas
/*
const { data, error } = await supabase.rpc('get_notifications', {
  p_limit: 100,
  p_unread_only: true
});
*/

-- JavaScript - Marcar como leída
/*
const { data, error } = await supabase.rpc('mark_notification_read', {
  p_notification_id: 'uuid-here'
});
*/

-- JavaScript - Marcar todas como leídas
/*
const { data, error } = await supabase.rpc('mark_all_notifications_read');
*/

-- JavaScript - Suscribirse a nuevas notificaciones en tiempo real
/*
const subscription = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Nueva notificación:', payload.new);
      // Actualizar UI
    }
  )
  .subscribe();
*/

-- ============================================
-- LIMPIAR NOTIFICACIONES ANTIGUAS (OPCIONAL)
-- ============================================
-- Función para limpiar notificaciones leídas mayores a 30 días

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE read = true
    AND read_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Programar con pg_cron (requiere extensión pg_cron)
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT public.cleanup_old_notifications()');
