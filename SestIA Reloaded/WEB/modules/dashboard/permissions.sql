-- =====================================================
-- PERMISOS PARA MÓDULO DASHBOARD V2
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Crear permisos del módulo dashboard
INSERT INTO permissions (perm_key, name, description, module) VALUES
('dashboard.view', 'Ver Dashboard', 'Acceso de lectura al dashboard de métricas', 'dashboard'),
('dashboard.export', 'Exportar Dashboard', 'Permite exportar métricas del dashboard', 'dashboard')
ON CONFLICT (perm_key) DO NOTHING;

-- Asignar permisos a roles
INSERT INTO role_permissions (role_key, perm_key) VALUES
('admin', 'dashboard.view'),
('admin', 'dashboard.export'),
('superadmin', 'dashboard.view'),
('superadmin', 'dashboard.export')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- =====================================================
-- FUNCIÓN RPC: get_dashboard_metrics_v2
-- Obtiene todas las métricas con filtro por período
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_v2(
    p_fecha_inicio TIMESTAMPTZ DEFAULT NULL,
    p_fecha_fin TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    v_fecha_inicio TIMESTAMPTZ;
    v_fecha_fin TIMESTAMPTZ;
BEGIN
    v_fecha_inicio := COALESCE(p_fecha_inicio, '1900-01-01'::TIMESTAMPTZ);
    v_fecha_fin := COALESCE(p_fecha_fin, NOW());

    SELECT json_build_object(
        'reportes', json_build_object(
            'total', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'emails_enviados', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE email_sent = true AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'emails_abiertos', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE email_opened = true AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'anonimos', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE es_anonimo = true AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'notificados', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE notificado = true AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'cerrados', (SELECT COUNT(*) FROM kpi_data_sofia.reportes WHERE LOWER(estado_actual) LIKE '%cerrado%' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'tiempo_resolucion_promedio', (
                SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (fecha_resolucion - fecha_creacion))/86400)::numeric, 1), 0)
                FROM kpi_data_sofia.reportes
                WHERE fecha_resolucion IS NOT NULL AND fecha_creacion IS NOT NULL
                AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin
            ),
            'por_estado', (
                SELECT COALESCE(json_agg(json_build_object('name', estado_actual, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(estado_actual, 'Sin estado') as estado_actual, COUNT(*) as cnt
                    FROM kpi_data_sofia.reportes
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY estado_actual
                ) sub
            ),
            'por_departamento', (
                SELECT COALESCE(json_agg(json_build_object('name', dept, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(institucion_responsable, 'Sin asignar') as dept, COUNT(*) as cnt
                    FROM kpi_data_sofia.reportes
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY institucion_responsable
                ) sub
            )
        ),
        'pagos', json_build_object(
            'total', (SELECT COUNT(*) FROM instancia_sofia.pagos WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'total_usd', (SELECT COALESCE(SUM(monto_pagado), 0) FROM instancia_sofia.pagos WHERE moneda = 'USD' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'total_ves', (SELECT COALESCE(SUM(monto_pagado), 0) FROM instancia_sofia.pagos WHERE moneda = 'VES' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'cantidad_usd', (SELECT COUNT(*) FROM instancia_sofia.pagos WHERE moneda = 'USD' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'cantidad_ves', (SELECT COUNT(*) FROM instancia_sofia.pagos WHERE moneda = 'VES' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'verificados', (SELECT COUNT(*) FROM instancia_sofia.pagos WHERE estado_pago IN ('verificado', 'exitoso', 'aprobado') AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'pendientes', (SELECT COUNT(*) FROM instancia_sofia.pagos WHERE estado_pago = 'pendiente_verificacion' AND created_at BETWEEN v_fecha_inicio AND v_fecha_fin),
            'por_metodo', (
                SELECT COALESCE(json_agg(json_build_object('name', metodo, 'count', cnt, 'monto_usd', monto_usd, 'monto_ves', monto_ves) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(metodo_pago_utilizado, 'Sin especificar') as metodo, COUNT(*) as cnt,
                           COALESCE(SUM(CASE WHEN moneda = 'USD' THEN monto_pagado ELSE 0 END), 0) as monto_usd,
                           COALESCE(SUM(CASE WHEN moneda = 'VES' THEN monto_pagado ELSE 0 END), 0) as monto_ves
                    FROM instancia_sofia.pagos
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY metodo_pago_utilizado
                ) sub
            ),
            'por_tipo', (
                SELECT COALESCE(json_agg(json_build_object('name', tipo, 'count', cnt, 'monto_usd', monto_usd, 'monto_ves', monto_ves) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(tipo_de_pago, 'Sin especificar') as tipo, COUNT(*) as cnt,
                           COALESCE(SUM(CASE WHEN moneda = 'USD' THEN monto_pagado ELSE 0 END), 0) as monto_usd,
                           COALESCE(SUM(CASE WHEN moneda = 'VES' THEN monto_pagado ELSE 0 END), 0) as monto_ves
                    FROM instancia_sofia.pagos
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY tipo_de_pago
                ) sub
            ),
            'por_moneda', (
                SELECT COALESCE(json_agg(json_build_object('name', moneda, 'count', cnt, 'monto', monto) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(moneda, 'Sin especificar') as moneda, COUNT(*) as cnt, COALESCE(SUM(monto_pagado), 0) as monto
                    FROM instancia_sofia.pagos
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY moneda
                ) sub
            ),
            'por_estado', (
                SELECT COALESCE(json_agg(json_build_object('name', estado, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
                FROM (
                    SELECT COALESCE(estado_pago, 'Sin estado') as estado, COUNT(*) as cnt
                    FROM instancia_sofia.pagos
                    WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin
                    GROUP BY estado_pago
                ) sub
            )
        ),
        'general', json_build_object(
            'abonados_atendidos', (SELECT COUNT(*) FROM instancia_sofia.agent_contact_list WHERE contact_prompt_count > 0),
            'total_conversaciones', (SELECT COUNT(*) FROM kpi_data_sofia.conversations WHERE created_at BETWEEN v_fecha_inicio AND v_fecha_fin)
        )
    ) INTO result;

    RETURN result;
END;
$$;

-- =====================================================
-- NOTAS:
-- - La función usa SECURITY DEFINER para evitar problemas de RLS
-- - Acepta parámetros de fecha opcionales para filtrar por período
-- - Si no se pasan fechas, retorna todos los datos
-- - Las tablas consultadas son:
--   * kpi_data_sofia.reportes
--   * kpi_data_sofia.conversations
--   * instancia_sofia.pagos
--   * instancia_sofia.agent_contact_list
-- =====================================================
