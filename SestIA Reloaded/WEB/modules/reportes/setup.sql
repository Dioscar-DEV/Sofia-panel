-- ========================================
-- MÓDULO REPORTES - SETUP PARA SOFIA
-- Sistema simplificado de reportes/tickets
-- ========================================

-- 1. Crear tabla principal de reportes
CREATE TABLE IF NOT EXISTS public.reportes (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100),
  subcategoria VARCHAR(100),
  estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'cerrado', 'rechazado')),
  prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  
  -- Información del reportante
  reportante_nombre VARCHAR(255),
  reportante_email VARCHAR(255),
  reportante_telefono VARCHAR(50),
  reportante_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ubicación
  ubicacion_texto TEXT,
  ubicacion_coords JSONB, -- {lat: float, lng: float}
  
  -- Evidencias y archivos
  evidencias JSONB, -- Array de URLs o objetos con url, nombre, tipo
  
  -- Asignación y seguimiento
  asignado_a UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  
  -- Metadatos
  fuente VARCHAR(50) DEFAULT 'web', -- web, whatsapp, email, etc
  metadata JSONB, -- Datos adicionales flexibles
  
  -- Historial (se puede mover a tabla separada si crece mucho)
  historial JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  cerrado_at TIMESTAMPTZ
);

-- 2. Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON public.reportes(estado);
CREATE INDEX IF NOT EXISTS idx_reportes_categoria ON public.reportes(categoria);
CREATE INDEX IF NOT EXISTS idx_reportes_asignado ON public.reportes(asignado_a);
CREATE INDEX IF NOT EXISTS idx_reportes_created ON public.reportes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_reportante ON public.reportes(reportante_user_id);

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_reportes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reportes_updated_at
  BEFORE UPDATE ON public.reportes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reportes_updated_at();

-- 4. RLS (Row Level Security)
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios pueden ver reportes según sus permisos
CREATE POLICY reportes_select_policy ON public.reportes
  FOR SELECT
  USING (
    -- Admin puede ver todo
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
    OR
    -- Usuario con permiso reportes.view puede ver todo
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
      AND up.perm_key = 'reportes.view'
    )
    OR
    -- Los usuarios pueden ver sus propios reportes
    reportante_user_id = auth.uid()
    OR
    -- Los asignados pueden ver los reportes asignados a ellos
    asignado_a = auth.uid()
  );

-- Policy: Insertar reportes
CREATE POLICY reportes_insert_policy ON public.reportes
  FOR INSERT
  WITH CHECK (
    -- Admin puede insertar
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
    OR
    -- Usuario con permiso reportes.create puede insertar
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
      AND up.perm_key = 'reportes.create'
    )
    OR
    -- Cualquier usuario autenticado puede crear su propio reporte
    (auth.uid() IS NOT NULL AND reportante_user_id = auth.uid())
  );

-- Policy: Actualizar reportes
CREATE POLICY reportes_update_policy ON public.reportes
  FOR UPDATE
  USING (
    -- Admin puede actualizar todo
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
    OR
    -- Usuario con permiso reportes.manage puede actualizar
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
      AND up.perm_key = 'reportes.manage'
    )
    OR
    -- Los asignados pueden actualizar sus reportes
    asignado_a = auth.uid()
  );

-- Policy: Eliminar reportes (solo admin)
CREATE POLICY reportes_delete_policy ON public.reportes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- 5. Función RPC para listar reportes con filtros
CREATE OR REPLACE FUNCTION public.reportes_list_filtrado(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50,
  p_search_text TEXT DEFAULT NULL,
  p_id TEXT DEFAULT NULL,
  p_estado VARCHAR DEFAULT NULL,
  p_categoria VARCHAR DEFAULT NULL,
  p_subcategoria VARCHAR DEFAULT NULL,
  p_prioridad VARCHAR DEFAULT NULL,
  p_asignado UUID DEFAULT NULL,
  p_periodo VARCHAR DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  titulo TEXT,
  descripcion TEXT,
  categoria VARCHAR,
  subcategoria VARCHAR,
  estado VARCHAR,
  prioridad VARCHAR,
  reportante_nombre VARCHAR,
  reportante_email VARCHAR,
  reportante_telefono VARCHAR,
  reportante_user_id UUID,
  ubicacion_texto TEXT,
  ubicacion_coords JSONB,
  evidencias JSONB,
  asignado_a UUID,
  fuente VARCHAR,
  metadata JSONB,
  historial JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  cerrado_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
  v_fecha_desde TIMESTAMPTZ;
  v_fecha_hasta TIMESTAMPTZ;
BEGIN
  -- Calcular offset
  v_offset := (p_page - 1) * p_limit;
  
  -- Calcular rango de fechas según período
  IF p_periodo IS NOT NULL THEN
    CASE p_periodo
      WHEN 'hoy' THEN
        v_fecha_desde := date_trunc('day', now());
        v_fecha_hasta := now();
      WHEN 'ayer' THEN
        v_fecha_desde := date_trunc('day', now() - interval '1 day');
        v_fecha_hasta := date_trunc('day', now());
      WHEN 'ultimos7' THEN
        v_fecha_desde := now() - interval '7 days';
        v_fecha_hasta := now();
      WHEN 'ultimos30' THEN
        v_fecha_desde := now() - interval '30 days';
        v_fecha_hasta := now();
      WHEN 'este_mes' THEN
        v_fecha_desde := date_trunc('month', now());
        v_fecha_hasta := now();
      WHEN 'mes_pasado' THEN
        v_fecha_desde := date_trunc('month', now() - interval '1 month');
        v_fecha_hasta := date_trunc('month', now());
      WHEN 'custom' THEN
        IF p_desde IS NOT NULL THEN
          v_fecha_desde := p_desde::TIMESTAMPTZ;
        END IF;
        IF p_hasta IS NOT NULL THEN
          v_fecha_hasta := (p_hasta::DATE + interval '1 day')::TIMESTAMPTZ;
        END IF;
    END CASE;
  END IF;
  
  -- Contar total de registros que cumplen los filtros
  SELECT COUNT(*) INTO v_total
  FROM public.reportes r
  WHERE (p_search_text IS NULL OR 
         r.titulo ILIKE '%' || p_search_text || '%' OR
         r.descripcion ILIKE '%' || p_search_text || '%' OR
         r.reportante_nombre ILIKE '%' || p_search_text || '%')
    AND (p_id IS NULL OR r.id = p_id::BIGINT)
    AND (p_estado IS NULL OR r.estado = p_estado)
    AND (p_categoria IS NULL OR r.categoria = p_categoria)
    AND (p_subcategoria IS NULL OR r.subcategoria = p_subcategoria)
    AND (p_prioridad IS NULL OR r.prioridad = p_prioridad)
    AND (p_asignado IS NULL OR r.asignado_a = p_asignado)
    AND (v_fecha_desde IS NULL OR r.created_at >= v_fecha_desde)
    AND (v_fecha_hasta IS NULL OR r.created_at <= v_fecha_hasta);
  
  -- Retornar resultados paginados
  RETURN QUERY
  SELECT 
    r.id,
    r.titulo,
    r.descripcion,
    r.categoria,
    r.subcategoria,
    r.estado,
    r.prioridad,
    r.reportante_nombre,
    r.reportante_email,
    r.reportante_telefono,
    r.reportante_user_id,
    r.ubicacion_texto,
    r.ubicacion_coords,
    r.evidencias,
    r.asignado_a,
    r.fuente,
    r.metadata,
    r.historial,
    r.created_at,
    r.updated_at,
    r.cerrado_at,
    v_total as total_count
  FROM public.reportes r
  WHERE (p_search_text IS NULL OR 
         r.titulo ILIKE '%' || p_search_text || '%' OR
         r.descripcion ILIKE '%' || p_search_text || '%' OR
         r.reportante_nombre ILIKE '%' || p_search_text || '%')
    AND (p_id IS NULL OR r.id = p_id::BIGINT)
    AND (p_estado IS NULL OR r.estado = p_estado)
    AND (p_categoria IS NULL OR r.categoria = p_categoria)
    AND (p_subcategoria IS NULL OR r.subcategoria = p_subcategoria)
    AND (p_prioridad IS NULL OR r.prioridad = p_prioridad)
    AND (p_asignado IS NULL OR r.asignado_a = p_asignado)
    AND (v_fecha_desde IS NULL OR r.created_at >= v_fecha_desde)
    AND (v_fecha_hasta IS NULL OR r.created_at <= v_fecha_hasta)
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- 6. Función para obtener opciones de filtros
CREATE OR REPLACE FUNCTION public.get_reportes_filter_options()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'categorias', (
      SELECT jsonb_agg(DISTINCT categoria ORDER BY categoria)
      FROM public.reportes
      WHERE categoria IS NOT NULL
    ),
    'subcategorias', (
      SELECT jsonb_agg(DISTINCT subcategoria ORDER BY subcategoria)
      FROM public.reportes
      WHERE subcategoria IS NOT NULL
    ),
    'estados', (
      SELECT jsonb_agg(DISTINCT estado ORDER BY estado)
      FROM public.reportes
    ),
    'prioridades', (
      SELECT jsonb_agg(DISTINCT prioridad ORDER BY prioridad)
      FROM public.reportes
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 7. Función para cambiar estado de un reporte
CREATE OR REPLACE FUNCTION public.reportes_cambiar_estado(
  p_reporte_id BIGINT,
  p_nuevo_estado VARCHAR,
  p_comentario TEXT DEFAULT NULL,
  p_usuario_email VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado_anterior VARCHAR;
  v_historial JSONB;
  v_usuario_nombre VARCHAR;
BEGIN
  -- Obtener estado anterior
  SELECT estado INTO v_estado_anterior
  FROM public.reportes
  WHERE id = p_reporte_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reporte no encontrado');
  END IF;
  
  -- Obtener nombre del usuario
  SELECT name INTO v_usuario_nombre
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Preparar entrada de historial
  v_historial := jsonb_build_object(
    'fecha', now(),
    'usuario', COALESCE(v_usuario_nombre, p_usuario_email, 'Sistema'),
    'accion', 'cambio_estado',
    'estado_anterior', v_estado_anterior,
    'estado_nuevo', p_nuevo_estado,
    'comentario', p_comentario
  );
  
  -- Actualizar reporte
  UPDATE public.reportes
  SET 
    estado = p_nuevo_estado,
    historial = historial || v_historial,
    cerrado_at = CASE WHEN p_nuevo_estado IN ('cerrado', 'resuelto') THEN now() ELSE cerrado_at END
  WHERE id = p_reporte_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'id', p_reporte_id,
    'estado_anterior', v_estado_anterior,
    'estado_nuevo', p_nuevo_estado
  );
END;
$$;

-- 8. Insertar permisos en la tabla permissions
INSERT INTO public.permissions (perm_key, name, description, module) VALUES
  ('reportes.view', 'Ver Reportes', 'Acceso de lectura al módulo de reportes', 'reportes'),
  ('reportes.create', 'Crear Reportes', 'Crear nuevos reportes', 'reportes'),
  ('reportes.manage', 'Gestionar Reportes', 'Editar y cambiar estado de reportes', 'reportes'),
  ('reportes.export', 'Exportar Reportes', 'Exportar reportes a CSV', 'reportes'),
  ('reportes.delete', 'Eliminar Reportes', 'Eliminar reportes del sistema', 'reportes')
ON CONFLICT (perm_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- 9. Asignar permisos al rol admin
INSERT INTO public.role_permissions (role_key, perm_key)
SELECT 'admin', perm_key
FROM public.permissions
WHERE module = 'reportes'
ON CONFLICT DO NOTHING;

-- 10. Comentarios en las tablas
COMMENT ON TABLE public.reportes IS 'Sistema de reportes/tickets de Sofia';
COMMENT ON COLUMN public.reportes.historial IS 'Array JSONB con historial de cambios';
COMMENT ON COLUMN public.reportes.evidencias IS 'Array JSONB con URLs de archivos/imágenes';
COMMENT ON COLUMN public.reportes.metadata IS 'Datos adicionales flexibles en formato JSONB';

-- Listo! 🎉
-- Para aplicar este setup, ejecuta este archivo en tu base de datos de Supabase
