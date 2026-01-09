-- Migración: Agregar filtro por usuario a reportes_list_filtrado
-- Fecha: 2026-01-09
-- Descripción: Actualiza la función RPC para permitir filtrar reportes por user_id (reportante_user_id)

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
  p_hasta DATE DEFAULT NULL,
  p_user_id UUID DEFAULT NULL  -- NUEVO PARÁMETRO
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
    AND (p_user_id IS NULL OR r.reportante_user_id = p_user_id)  -- NUEVA CONDICIÓN
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
    AND (p_user_id IS NULL OR r.reportante_user_id = p_user_id)  -- NUEVA CONDICIÓN
    AND (v_fecha_desde IS NULL OR r.created_at >= v_fecha_desde)
    AND (v_fecha_hasta IS NULL OR r.created_at <= v_fecha_hasta)
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- Comentario sobre la función
COMMENT ON FUNCTION public.reportes_list_filtrado IS 
'Lista reportes con filtros avanzados. Ahora incluye p_user_id para filtrar por reportante_user_id.';
