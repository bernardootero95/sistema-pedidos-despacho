-- ============================================================================
-- Dashboard: cortar días y meses en la hora local del negocio, no en UTC
-- ============================================================================
-- obtener_resumen_dashboard y obtener_ventas_diarias usaban CURRENT_DATE y
-- `fecha::date`, que se evalúan en la zona horaria de la base (UTC en
-- Supabase). En Colombia (UTC-5) eso significa que:
--   * desde las 7 p.m. la "venta del día" ya es la de mañana (arranca en 0),
--   * un pedido de las 8 p.m. aparece en el gráfico en el día siguiente,
--   * el último día del mes, desde las 7 p.m. el mes "cambia" antes de tiempo.
--
-- Se reescriben con la misma técnica que obtener_informe_ventas
-- (20260928100000): los límites locales se convierten a TIMESTAMPTZ una
-- vez y se filtra por rango (sin castear cada fila). Además
-- obtener_ventas_diarias pasa de 60 subconsultas correlacionadas (una por
-- día y serie) a una sola agregación por día local.
--
-- Mismas firmas, mismo modo (SECURITY INVOKER: respeta la RLS por rol) y
-- mismas reglas de negocio que 20260827100000 — solo cambia el corte de
-- fechas. p_zona_horaria es opcional con el valor del negocio por defecto,
-- así que el frontend no cambia.
-- ============================================================================

DROP FUNCTION IF EXISTS obtener_resumen_dashboard(UUID);

CREATE OR REPLACE FUNCTION obtener_resumen_dashboard(
  p_vendedor_id UUID DEFAULT NULL,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
  v_hoy DATE;
  v_inicio_dia TIMESTAMPTZ;
  v_fin_dia TIMESTAMPTZ;
  v_inicio_mes TIMESTAMPTZ;
  v_fin_mes TIMESTAMPTZ;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  v_hoy := (NOW() AT TIME ZONE p_zona_horaria)::date;
  v_inicio_dia := v_hoy::timestamp AT TIME ZONE p_zona_horaria;
  v_fin_dia := (v_hoy + 1)::timestamp AT TIME ZONE p_zona_horaria;
  v_inicio_mes := date_trunc('month', v_hoy)::timestamp AT TIME ZONE p_zona_horaria;
  v_fin_mes := (date_trunc('month', v_hoy) + INTERVAL '1 month')::timestamp AT TIME ZONE p_zona_horaria;

  RETURN (
    SELECT jsonb_build_object(
      'total_pedidos', COUNT(*),
      'pedidos_pendientes', COUNT(*) FILTER (WHERE estado = 'pendiente'),
      'pedidos_despachados', COUNT(*) FILTER (WHERE estado = 'despachado'),
      'pedidos_entregados', COUNT(*) FILTER (WHERE estado = 'entregado'),
      'pedidos_devueltos', COUNT(*) FILTER (WHERE estado = 'devuelto'),
      'venta_real_dia', COALESCE(SUM(total) FILTER (
        WHERE estado = 'entregado' AND fecha_entrega >= v_inicio_dia AND fecha_entrega < v_fin_dia
      ), 0),
      'venta_real_mes', COALESCE(SUM(total) FILTER (
        WHERE estado = 'entregado' AND fecha_entrega >= v_inicio_mes AND fecha_entrega < v_fin_mes
      ), 0),
      'preventa_dia', COALESCE(SUM(total) FILTER (
        WHERE estado IN ('pendiente', 'despachado') AND fecha_pedido >= v_inicio_dia AND fecha_pedido < v_fin_dia
      ), 0),
      'preventa_mes', COALESCE(SUM(total) FILTER (
        WHERE estado IN ('pendiente', 'despachado') AND fecha_pedido >= v_inicio_mes AND fecha_pedido < v_fin_mes
      ), 0),
      'despachos_activos', (
        SELECT COUNT(*) FROM despachos
        WHERE eliminado IS NULL AND estado = 'en_ruta'
      )
    )
    FROM pedidos_cabecera
    WHERE eliminado IS NULL
      AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
  );
END;
$$;

DROP FUNCTION IF EXISTS obtener_ventas_diarias(UUID);

CREATE OR REPLACE FUNCTION obtener_ventas_diarias(
  p_vendedor_id UUID DEFAULT NULL,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS TABLE(fecha DATE, venta_real NUMERIC, preventa NUMERIC)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
  v_hoy DATE;
  v_desde DATE;
  v_inicio TIMESTAMPTZ;
  v_fin TIMESTAMPTZ;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  v_hoy := (NOW() AT TIME ZONE p_zona_horaria)::date;
  v_desde := v_hoy - 29;
  v_inicio := v_desde::timestamp AT TIME ZONE p_zona_horaria;
  v_fin := (v_hoy + 1)::timestamp AT TIME ZONE p_zona_horaria;

  RETURN QUERY
  WITH movimientos AS (
    -- Venta real: por día local de entrega.
    SELECT (pc.fecha_entrega AT TIME ZONE p_zona_horaria)::date AS dia, pc.total AS real, 0::numeric AS pre
    FROM pedidos_cabecera pc
    WHERE pc.eliminado IS NULL AND pc.estado = 'entregado'
      AND pc.fecha_entrega >= v_inicio AND pc.fecha_entrega < v_fin
      AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    UNION ALL
    -- Preventa: por día local del pedido.
    SELECT (pc.fecha_pedido AT TIME ZONE p_zona_horaria)::date, 0::numeric, pc.total
    FROM pedidos_cabecera pc
    WHERE pc.eliminado IS NULL AND pc.estado IN ('pendiente', 'despachado')
      AND pc.fecha_pedido >= v_inicio AND pc.fecha_pedido < v_fin
      AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
  ),
  por_dia AS (
    SELECT m.dia, SUM(m.real) AS real, SUM(m.pre) AS pre
    FROM movimientos m
    GROUP BY m.dia
  )
  SELECT
    d::date AS fecha,
    COALESCE(pd.real, 0) AS venta_real,
    COALESCE(pd.pre, 0) AS preventa
  FROM generate_series(v_desde, v_hoy, INTERVAL '1 day') AS d
  LEFT JOIN por_dia pd ON pd.dia = d::date
  ORDER BY d;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_resumen_dashboard(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_resumen_dashboard(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION obtener_ventas_diarias(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_ventas_diarias(UUID, TEXT) FROM anon, public;
