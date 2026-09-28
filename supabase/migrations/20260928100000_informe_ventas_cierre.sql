-- ============================================================================
-- Informe de ventas diario / cierre de mes (soporte/gerencia)
-- ============================================================================
-- Resume un período (un día o un mes, el frontend solo arma el rango) en:
--
--   * preventa              → TODOS los pedidos del período sin importar su
--                             estado, por fecha_pedido.
--   * ventas                → pedidos 'entregado' por fecha_entrega (la venta
--                             real es del día en que se entrega, no del día
--                             en que se tomó — mismo criterio que venta_real
--                             del dashboard, 20260827100000).
--   * anulados / devueltos  → pedidos 'anulado' y 'devuelto' del período,
--                             por fecha_pedido (son preventa que se cayó).
--   * pendientes_periodo    → pedidos aún sin entregar ('pendiente' o
--                             'despachado') tomados dentro del período.
--   * pendientes_anteriores → pedidos aún sin entregar tomados ANTES del
--                             período (arrastre de días/meses anteriores).
--
-- Los pendientes son una foto del estado ACTUAL: un pedido del día 3
-- entregado el día 10 ya no figura como pendiente al consultar el día 3.
--
-- Las fechas se cortan en la zona horaria del negocio (p_zona_horaria), no
-- en UTC: la base corre en UTC y un pedido de las 8 p.m. en Colombia ya es
-- "mañana" en UTC. Los límites se convierten a TIMESTAMPTZ una sola vez
-- para que los filtros sobre fecha_pedido/fecha_entrega sigan siendo
-- comparaciones de rango (aprovechan índices) en vez de castear cada fila.
--
-- Mismo guard de rol que obtener_informe_productos_pedidos (20260902100000):
-- cruza pedidos de todos los vendedores, así que el control vive acá.
-- ============================================================================

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
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fin TIMESTAMPTZ;
  v_resultado JSONB;
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

  -- [v_inicio, v_fin): medianoche local del primer día hasta medianoche
  -- local del día siguiente al último. Una zona horaria inválida ya hace
  -- fallar el AT TIME ZONE con un error claro.
  v_inicio := p_fecha_desde::timestamp AT TIME ZONE p_zona_horaria;
  v_fin := (p_fecha_hasta + 1)::timestamp AT TIME ZONE p_zona_horaria;

  WITH pedidos AS (
    SELECT
      c.id,
      c.numero_pedido,
      c.fecha_pedido,
      c.fecha_entrega,
      c.estado,
      COALESCE(c.total, 0) AS total,
      COALESCE(
        NULLIF(cl.razon_social, ''),
        TRIM(COALESCE(cl.primer_nombre, '') || ' ' || COALESCE(cl.primer_apellido, ''))
      ) AS cliente,
      pf.nombre_completo AS vendedor,
      -- Un pedido cae en UNA categoría de detalle (además de contar en
      -- preventa si fue tomado en el período).
      CASE
        WHEN c.estado = 'entregado'
          AND c.fecha_entrega >= v_inicio AND c.fecha_entrega < v_fin THEN 'venta'
        WHEN c.estado = 'anulado'
          AND c.fecha_pedido >= v_inicio AND c.fecha_pedido < v_fin THEN 'anulado'
        WHEN c.estado = 'devuelto'
          AND c.fecha_pedido >= v_inicio AND c.fecha_pedido < v_fin THEN 'devuelto'
        WHEN c.estado IN ('pendiente', 'despachado')
          AND c.fecha_pedido >= v_inicio AND c.fecha_pedido < v_fin THEN 'pendiente_periodo'
        WHEN c.estado IN ('pendiente', 'despachado')
          AND c.fecha_pedido < v_inicio THEN 'pendiente_anterior'
      END AS categoria,
      (c.fecha_pedido >= v_inicio AND c.fecha_pedido < v_fin) AS es_preventa
    FROM pedidos_cabecera c
    JOIN clientes cl ON cl.id = c.cliente_id
    LEFT JOIN perfiles pf ON pf.id = c.vendedor_id
    WHERE c.eliminado IS NULL
      AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
      AND (
        (c.fecha_pedido >= v_inicio AND c.fecha_pedido < v_fin)
        OR (c.estado = 'entregado' AND c.fecha_entrega >= v_inicio AND c.fecha_entrega < v_fin)
        OR (c.estado IN ('pendiente', 'despachado') AND c.fecha_pedido < v_inicio)
      )
  )
  SELECT jsonb_build_object(
    'resumen', jsonb_build_object(
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
    ),
    'detalle', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'categoria', categoria,
          'numero_pedido', numero_pedido,
          'cliente', cliente,
          'vendedor', vendedor,
          'estado', estado,
          'fecha_pedido', fecha_pedido,
          'fecha_entrega', fecha_entrega,
          'total', total
        )
        ORDER BY fecha_pedido
      ) FILTER (WHERE categoria IS NOT NULL),
      '[]'::jsonb
    )
  )
  INTO v_resultado
  FROM pedidos;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_informe_ventas(DATE, DATE, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_informe_ventas(DATE, DATE, UUID, TEXT) FROM anon, public;
