-- ============================================================================
-- Métricas avanzadas del Dashboard: venta real vs preventa, día/mes,
-- conteos por estado y filtro por vendedor
-- ============================================================================
-- Hasta ahora "Ventas Totales" sumaba cualquier pedido no anulado, sin
-- distinguir si ya se entregó. Un pedido es solo una PREVENTA mientras está
-- 'pendiente' o 'despachado' (aún no genera ingreso real); se vuelve VENTA
-- REAL únicamente cuando estado = 'entregado'. 'devuelto' y 'anulado' no
-- cuentan en ninguna de las dos: no hubo ingreso y no hay operación vigente.
--
-- Se agrega el corte diario/mensual (hoy vs mes en curso) y los conteos por
-- estado (pendiente, despachado "en ruta", entregado, devuelto) que antes no
-- existían en el resumen.
--
-- Filtro por vendedor: gerencia/soporte pueden ver el desglose de un
-- vendedor puntual; despachador solo ve el valor global (no se le expone el
-- filtro en el frontend, pero además el guard de acá lo ignora si de todos
-- modos lo manda, igual que un vendedor/repartidor). No hace falta que el
-- guard distinga vendedor/repartidor de despachador para la seguridad de los
-- datos: la RLS de pedidos_cabecera (20260818090000) ya acota lo que cada
-- rol puede leer: un vendedor jamás ve filas de otro sin importar el
-- parámetro. El guard es una regla de producto (quién puede pedir el
-- desglose por tercero), no un límite de acceso a datos.
-- ============================================================================

DROP FUNCTION IF EXISTS obtener_resumen_dashboard();
DROP FUNCTION IF EXISTS obtener_ventas_diarias();

CREATE OR REPLACE FUNCTION obtener_resumen_dashboard(p_vendedor_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'total_pedidos', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
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
    'pedidos_entregados', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_devueltos', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'devuelto'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'venta_real_dia', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND fecha_pedido::date = CURRENT_DATE
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'venta_real_mes', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND date_trunc('month', fecha_pedido) = date_trunc('month', CURRENT_DATE)
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'preventa_dia', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado IN ('pendiente', 'despachado')
        AND fecha_pedido::date = CURRENT_DATE
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'preventa_mes', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado IN ('pendiente', 'despachado')
        AND date_trunc('month', fecha_pedido) = date_trunc('month', CURRENT_DATE)
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    -- No se filtra por vendedor: una ruta la arma el despachador con
    -- pedidos de varios vendedores, no tiene dueño individual.
    'despachos_activos', (
      SELECT COUNT(*) FROM despachos
      WHERE eliminado IS NULL AND estado = 'en_ruta'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_resumen_dashboard(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Ventas diarias (últimos 30 días) separadas en venta real vs preventa
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_ventas_diarias(p_vendedor_id UUID DEFAULT NULL)
RETURNS TABLE(fecha DATE, venta_real NUMERIC, preventa NUMERIC)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  RETURN QUERY
  SELECT
    dia::date AS fecha,
    COALESCE(SUM(CASE WHEN pc.estado = 'entregado' THEN pc.total ELSE 0 END), 0) AS venta_real,
    COALESCE(SUM(CASE WHEN pc.estado IN ('pendiente', 'despachado') THEN pc.total ELSE 0 END), 0) AS preventa
  FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS dia
  LEFT JOIN pedidos_cabecera pc
    ON pc.fecha_pedido::date = dia::date
    AND pc.eliminado IS NULL
    AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
  GROUP BY dia
  ORDER BY dia;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_ventas_diarias(UUID) TO authenticated;
