-- ============================================================================
-- Informe de productos por pedidos (soporte/gerencia)
-- ============================================================================
-- Reporte agregado por producto (código, nombre, cantidad total, valor total,
-- # de pedidos) para un rango de fechas, con filtros opcionales de estado,
-- vendedor y cliente. A diferencia del listado de OrdersPage (una fila por
-- pedido), esto responde "cuánto se movió de cada producto", cruzando
-- pedidos de todos los vendedores — por eso va en un RPC SECURITY DEFINER
-- restringido a soporte/gerencia (mismo patrón de guard que
-- actualizar_fecha_entrega_pedido, 20260827100000), en vez de depender de
-- que la RLS de pedidos_detalle alcance para acotar por rol: esa RLS ya deja
-- pasar a soporte/gerencia sin restricción de vendedor (ver
-- pedidos_detalle_select_operativo, 20260811221215), así que el filtro por
-- rol tiene que vivir acá.
-- ============================================================================

CREATE OR REPLACE FUNCTION obtener_informe_productos_pedidos(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_campo_fecha TEXT DEFAULT 'fecha_entrega',
  p_estado TEXT DEFAULT NULL,
  p_vendedor_id UUID DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL
)
RETURNS TABLE(
  producto_id UUID,
  codigo TEXT,
  nombre TEXT,
  cantidad_total NUMERIC,
  monto_total NUMERIC,
  pedidos_count BIGINT
)
LANGUAGE plpgsql
STABLE
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

  IF p_campo_fecha NOT IN ('fecha_pedido', 'fecha_entrega') THEN
    p_campo_fecha := 'fecha_entrega';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS producto_id,
    p.codigo::TEXT,
    p.nombre::TEXT,
    SUM(d.cantidad) AS cantidad_total,
    SUM(d.subtotal_linea) AS monto_total,
    COUNT(DISTINCT d.pedido_id) AS pedidos_count
  FROM pedidos_detalle d
  JOIN pedidos_cabecera c ON c.id = d.pedido_id
  JOIN productos p ON p.id = d.producto_id
  WHERE c.eliminado IS NULL
    AND (
      (p_campo_fecha = 'fecha_pedido' AND c.fecha_pedido::date BETWEEN p_fecha_desde AND p_fecha_hasta)
      OR
      (p_campo_fecha = 'fecha_entrega' AND c.fecha_entrega::date BETWEEN p_fecha_desde AND p_fecha_hasta)
    )
    AND (p_estado IS NULL OR c.estado = p_estado)
    AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
    AND (p_cliente_id IS NULL OR c.cliente_id = p_cliente_id)
  GROUP BY p.id, p.codigo, p.nombre
  ORDER BY p.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_informe_productos_pedidos(DATE, DATE, TEXT, TEXT, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_informe_productos_pedidos(DATE, DATE, TEXT, TEXT, UUID, UUID) FROM anon;
