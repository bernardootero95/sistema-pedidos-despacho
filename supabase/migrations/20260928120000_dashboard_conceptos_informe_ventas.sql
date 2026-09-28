-- ============================================================================
-- Dashboard con los mismos conceptos que el informe de ventas
-- ============================================================================
-- El informe de ventas (20260928100000) definió, a pedido del negocio:
--   * preventa (total pedidos) → TODOS los pedidos, cualquier estado, por
--                                fecha_pedido.
--   * ventas                   → 'entregado', por fecha_entrega.
--   * anulados / devueltos     → por fecha_pedido.
--   * pendientes               → 'pendiente' o 'despachado', separados en
--                                del período y de períodos anteriores.
--
-- El dashboard usaba otra definición de preventa (solo pendiente +
-- despachado) y conteos históricos sin período. Para que ambos no vuelvan
-- a divergir, la clasificación se extrae a una sola función
-- (pedidos_ventas_periodo) y su resumen (resumen_ventas_periodo), y tanto
-- obtener_informe_ventas como obtener_resumen_dashboard/
-- obtener_ventas_diarias se apoyan en ellas.
--
-- Ambas son SECURITY INVOKER: llamadas desde el dashboard (invoker)
-- respetan la RLS por rol — un vendedor ve solo lo suyo —; llamadas desde
-- obtener_informe_ventas (SECURITY DEFINER, con guard soporte/gerencia)
-- ven todo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clasificación única de pedidos para un período
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pedidos_ventas_periodo(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_vendedor_id UUID DEFAULT NULL,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS TABLE(pedido_id UUID, categoria TEXT, es_preventa BOOLEAN, total NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Límites [inicio, fin) en hora local convertidos a TIMESTAMPTZ una sola
  -- vez: los filtros quedan como rangos sobre la columna (usan índices).
  WITH limites AS (
    SELECT
      p_fecha_desde::timestamp AT TIME ZONE p_zona_horaria AS inicio,
      (p_fecha_hasta + 1)::timestamp AT TIME ZONE p_zona_horaria AS fin
  )
  SELECT
    c.id,
    -- Un pedido cae en UNA categoría (además de contar en preventa si fue
    -- tomado en el período).
    CASE
      WHEN c.estado = 'entregado'
        AND c.fecha_entrega >= l.inicio AND c.fecha_entrega < l.fin THEN 'venta'
      WHEN c.estado = 'anulado'
        AND c.fecha_pedido >= l.inicio AND c.fecha_pedido < l.fin THEN 'anulado'
      WHEN c.estado = 'devuelto'
        AND c.fecha_pedido >= l.inicio AND c.fecha_pedido < l.fin THEN 'devuelto'
      WHEN c.estado IN ('pendiente', 'despachado')
        AND c.fecha_pedido >= l.inicio AND c.fecha_pedido < l.fin THEN 'pendiente_periodo'
      WHEN c.estado IN ('pendiente', 'despachado')
        AND c.fecha_pedido < l.inicio THEN 'pendiente_anterior'
    END,
    (c.fecha_pedido >= l.inicio AND c.fecha_pedido < l.fin),
    COALESCE(c.total, 0)
  FROM pedidos_cabecera c
  CROSS JOIN limites l
  WHERE c.eliminado IS NULL
    AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
    AND (
      (c.fecha_pedido >= l.inicio AND c.fecha_pedido < l.fin)
      OR (c.estado = 'entregado' AND c.fecha_entrega >= l.inicio AND c.fecha_entrega < l.fin)
      OR (c.estado IN ('pendiente', 'despachado') AND c.fecha_pedido < l.inicio)
    );
$$;

-- ----------------------------------------------------------------------------
-- 2. Resumen (cantidad y monto por concepto) de un período
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumen_ventas_periodo(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_vendedor_id UUID DEFAULT NULL,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'preventa', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE es_preventa),
      'monto', COALESCE(SUM(total) FILTER (WHERE es_preventa), 0)
    ),
    'ventas', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE categoria = 'venta'),
      'monto', COALESCE(SUM(total) FILTER (WHERE categoria = 'venta'), 0)
    ),
    'anulados', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE categoria = 'anulado'),
      'monto', COALESCE(SUM(total) FILTER (WHERE categoria = 'anulado'), 0)
    ),
    'devueltos', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE categoria = 'devuelto'),
      'monto', COALESCE(SUM(total) FILTER (WHERE categoria = 'devuelto'), 0)
    ),
    'pendientes_periodo', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE categoria = 'pendiente_periodo'),
      'monto', COALESCE(SUM(total) FILTER (WHERE categoria = 'pendiente_periodo'), 0)
    ),
    'pendientes_anteriores', jsonb_build_object(
      'cantidad', COUNT(*) FILTER (WHERE categoria = 'pendiente_anterior'),
      'monto', COALESCE(SUM(total) FILTER (WHERE categoria = 'pendiente_anterior'), 0)
    )
  )
  FROM pedidos_ventas_periodo(p_fecha_desde, p_fecha_hasta, p_vendedor_id, p_zona_horaria);
$$;

GRANT EXECUTE ON FUNCTION pedidos_ventas_periodo(DATE, DATE, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION pedidos_ventas_periodo(DATE, DATE, UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION resumen_ventas_periodo(DATE, DATE, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION resumen_ventas_periodo(DATE, DATE, UUID, TEXT) FROM anon, public;

-- ----------------------------------------------------------------------------
-- 3. obtener_informe_ventas: mismo contrato, ahora sobre las funciones
--    compartidas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_informe_ventas(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_vendedor_id UUID DEFAULT NULL,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para ver este informe.';
  END IF;

  IF p_fecha_desde IS NULL OR p_fecha_hasta IS NULL THEN
    RAISE EXCEPTION 'El rango de fechas es obligatorio.';
  END IF;

  IF p_fecha_hasta < p_fecha_desde THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde.';
  END IF;

  IF p_fecha_hasta - p_fecha_desde > 366 THEN
    RAISE EXCEPTION 'El rango del informe no puede superar un año.';
  END IF;

  RETURN jsonb_build_object(
    'resumen', resumen_ventas_periodo(p_fecha_desde, p_fecha_hasta, p_vendedor_id, p_zona_horaria),
    'detalle', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'categoria', pv.categoria,
            'numero_pedido', c.numero_pedido,
            'cliente', COALESCE(
              NULLIF(cl.razon_social, ''),
              TRIM(COALESCE(cl.primer_nombre, '') || ' ' || COALESCE(cl.primer_apellido, ''))
            ),
            'vendedor', pf.nombre_completo,
            'estado', c.estado,
            'fecha_pedido', c.fecha_pedido,
            'fecha_entrega', c.fecha_entrega,
            'total', pv.total
          )
          ORDER BY c.fecha_pedido
        ),
        '[]'::jsonb
      )
      FROM pedidos_ventas_periodo(p_fecha_desde, p_fecha_hasta, p_vendedor_id, p_zona_horaria) pv
      JOIN pedidos_cabecera c ON c.id = pv.pedido_id
      JOIN clientes cl ON cl.id = c.cliente_id
      LEFT JOIN perfiles pf ON pf.id = c.vendedor_id
      WHERE pv.categoria IS NOT NULL
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. obtener_resumen_dashboard: resumen de hoy y del mes en curso con los
--    conceptos del informe, más la foto operativa (pendientes por
--    despachar, en ruta, rutas activas).
-- ----------------------------------------------------------------------------
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
  v_inicio_mes DATE;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  v_hoy := (NOW() AT TIME ZONE p_zona_horaria)::date;
  v_inicio_mes := date_trunc('month', v_hoy)::date;

  RETURN jsonb_build_object(
    'hoy', resumen_ventas_periodo(v_hoy, v_hoy, v_filtro_vendedor, p_zona_horaria),
    -- Hasta hoy: los días que faltan del mes aún no tienen pedidos.
    'mes', resumen_ventas_periodo(v_inicio_mes, v_hoy, v_filtro_vendedor, p_zona_horaria),
    'pedidos_pendientes', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'pendiente'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_despachados', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'despachado'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'despachos_activos', (
      SELECT COUNT(*) FROM despachos
      WHERE eliminado IS NULL AND estado = 'en_ruta'
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. obtener_ventas_diarias: preventa = todos los pedidos del día (antes
--    solo pendiente + despachado), ventas = entregados por fecha de entrega.
-- ----------------------------------------------------------------------------
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
    -- Ventas: entregados, por día local de entrega.
    SELECT (pc.fecha_entrega AT TIME ZONE p_zona_horaria)::date AS dia, pc.total AS real, 0::numeric AS pre
    FROM pedidos_cabecera pc
    WHERE pc.eliminado IS NULL AND pc.estado = 'entregado'
      AND pc.fecha_entrega >= v_inicio AND pc.fecha_entrega < v_fin
      AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    UNION ALL
    -- Preventa: todos los pedidos, por día local del pedido.
    SELECT (pc.fecha_pedido AT TIME ZONE p_zona_horaria)::date, 0::numeric, pc.total
    FROM pedidos_cabecera pc
    WHERE pc.eliminado IS NULL
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
