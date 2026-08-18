-- ============================================================================
-- Vista del vendedor: solo sus propios pedidos + ventas diarias (dashboard)
-- ============================================================================
-- Hasta ahora pedidos_cabecera_select_operativo dejaba a cualquier vendedor
-- ver TODOS los pedidos de la empresa (mismo nivel que gerencia/soporte),
-- no solo los suyos. Se acota el rol vendedor a vendedor_id = auth.uid() en
-- SELECT/UPDATE de pedidos_cabecera y en el SELECT derivado de
-- pedidos_detalle. gerencia/soporte/despachador conservan visibilidad total
-- (el despachador necesita ver el universo de pendientes para armar rutas).
--
-- Efecto en cascada intencional: obtener_resumen_dashboard() y la nueva
-- obtener_ventas_diarias() NO son SECURITY DEFINER, así que heredan esta
-- misma RLS sin duplicar la regla de alcance — un vendedor ve sus propios
-- KPIs y su propia curva de ventas, no los de toda la empresa.
--
-- crear_pedido_transaccional no validaba el rol de quien la invoca (a
-- diferencia de editar_pedido_transaccional, que sí lo hace) y confiaba en
-- el p_vendedor_id que mandara el cliente. Sin cerrar esto, la restricción
-- de arriba queda coja: un vendedor podría crear un pedido con el
-- vendedor_id de otro y listo, se le "pierde" de su propio listado. Se
-- agrega el mismo guard de rol que ya usa editar_pedido_transaccional y se
-- fuerza vendedor_id = auth.uid() cuando quien llama es un vendedor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pedidos_cabecera: SELECT solo propios para vendedor
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pedidos_cabecera_select_operativo" ON pedidos_cabecera;

CREATE POLICY "pedidos_cabecera_select_operativo" ON pedidos_cabecera
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR (obtener_rol_actual() = 'vendedor' AND vendedor_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM despachos_pedidos dp
      JOIN despachos d ON d.id = dp.despacho_id
      WHERE dp.pedido_id = pedidos_cabecera.id
        AND d.repartidor_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. pedidos_cabecera: UPDATE (anular/editar) solo propios para vendedor
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pedidos_cabecera_update_comercial" ON pedidos_cabecera;

CREATE POLICY "pedidos_cabecera_update_comercial" ON pedidos_cabecera
  FOR UPDATE TO authenticated
  USING (
    obtener_rol_actual() IN ('gerencia', 'soporte')
    OR (
      obtener_rol_actual() = 'vendedor'
      AND estado = 'pendiente'
      AND vendedor_id = auth.uid()
    )
  )
  WITH CHECK (
    obtener_rol_actual() IN ('gerencia', 'soporte')
    OR (
      obtener_rol_actual() = 'vendedor'
      AND estado = 'pendiente'
      AND vendedor_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. pedidos_detalle: mismo alcance que su cabecera
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pedidos_detalle_select_operativo" ON pedidos_detalle;

CREATE POLICY "pedidos_detalle_select_operativo" ON pedidos_detalle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_cabecera pc
      WHERE pc.id = pedidos_detalle.pedido_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
          OR (obtener_rol_actual() = 'vendedor' AND pc.vendedor_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM despachos_pedidos dp
            JOIN despachos d ON d.id = dp.despacho_id
            WHERE dp.pedido_id = pc.id
              AND d.repartidor_id = auth.uid()
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. crear_pedido_transaccional: validar rol + no confiar en p_vendedor_id
--    cuando quien llama es un vendedor
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 2 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_producto RECORD;
  v_cantidad INTEGER;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_pedido TEXT;
  v_pedido_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor') THEN
    RAISE EXCEPTION 'No tienes permiso para crear pedidos.';
  END IF;

  -- Un vendedor siempre crea a su propio nombre, sin importar lo que mande
  -- el cliente: es lo único que mantiene coherente el filtro de
  -- "mis pedidos" en pedidos_cabecera_select_operativo.
  IF obtener_rol_actual() = 'vendedor' THEN
    p_vendedor_id := auth.uid();
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 1. Bloquear y validar cada producto (orden por id evita deadlocks entre
  --    transacciones concurrentes que compran los mismos productos).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, disponible, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    IF v_producto.disponible < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.disponible;
    END IF;

    v_precio := v_producto.precio_venta;
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea
    );

    -- Descontar stock inmediatamente (fila ya bloqueada con FOR UPDATE)
    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  -- 2. Generar consecutivo de forma segura dentro de la transacción
  SELECT COALESCE(MAX(numero_pedido::INTEGER), 0) + 1
    INTO v_numero_pedido
    FROM pedidos_cabecera
    WHERE numero_pedido ~ '^[0-9]+$';

  IF v_numero_pedido IS NULL THEN
    v_numero_pedido := '1';
  END IF;

  -- 3. Insertar cabecera
  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, 'pendiente')
  RETURNING id INTO v_pedido_id;

  -- 4. Insertar detalles
  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea
  )
  SELECT
    v_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Cualquier error revierte automáticamente toda la función (stock, cabecera, detalle)
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB) FROM anon;

-- ----------------------------------------------------------------------------
-- 5. Ventas diarias de los últimos 30 días para el gráfico del dashboard
-- ----------------------------------------------------------------------------
-- No es SECURITY DEFINER, mismo criterio que obtener_resumen_dashboard: la
-- RLS de pedidos_cabecera hace todo el trabajo de alcance por rol.
CREATE OR REPLACE FUNCTION obtener_ventas_diarias()
RETURNS TABLE(fecha DATE, total NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT dia::date AS fecha, COALESCE(SUM(pc.total), 0) AS total
  FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS dia
  LEFT JOIN pedidos_cabecera pc
    ON pc.fecha_pedido::date = dia::date
    AND pc.eliminado IS NULL
    AND pc.estado <> 'anulado'
  GROUP BY dia
  ORDER BY dia;
$$;

GRANT EXECUTE ON FUNCTION obtener_ventas_diarias() TO authenticated;
