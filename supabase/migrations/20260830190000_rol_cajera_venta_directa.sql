-- ============================================================================
-- Nuevo rol "cajera": venta directa en punto de venta, entrega inmediata
-- ============================================================================
-- A diferencia del vendedor (preventa: el pedido queda 'pendiente' hasta
-- que despachador/repartidor lo entregan), la cajera vende en el punto
-- físico y la mercancía sale de inmediato. Mismas capacidades que
-- vendedor (crear/ver sus propios pedidos y clientes, ver catálogo) más:
--   1. Puede usar precio frío y precio a crédito (mismos roles que ya
--      tenía despachador en resolver_precio_pedido).
--   2. Sus pedidos nacen directamente en estado 'entregado' con
--      fecha_entrega = NOW(), sin pasar por despachos/despachos_pedidos
--      (el sistema ya distinguía "venta real" de "preventa" por este
--      campo desde 20260827100000, esto solo agrega un tercer punto de
--      entrada directo a "venta real").
--
-- Consecuencia intencional: como editar_pedido_transaccional solo permite
-- editar pedidos en estado 'pendiente', un pedido de cajera queda no
-- editable apenas se crea (coherente con "venta ya cerrada"). Tampoco se
-- le da permiso de anular sus propias ventas entregadas: igual que hoy,
-- solo gerencia/soporte/despachador pueden anular pedidos que no están en
-- 'pendiente' propio de un vendedor (decisión explícita del negocio, no
-- se toca anular_pedido_transaccional ni ROLES_ANULAR_SIN_RESTRICCION en
-- el frontend).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Rol
-- ----------------------------------------------------------------------------
INSERT INTO roles (nombre, permisos) VALUES ('cajera', '[]'::jsonb)
ON CONFLICT (nombre) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. pedidos_cabecera: insertar, y ver/actualizar solo lo propio
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pedidos_cabecera_insert_comercial" ON pedidos_cabecera;
CREATE POLICY "pedidos_cabecera_insert_comercial" ON pedidos_cabecera
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera'));

DROP POLICY IF EXISTS "pedidos_cabecera_select_operativo" ON pedidos_cabecera;
CREATE POLICY "pedidos_cabecera_select_operativo" ON pedidos_cabecera
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR (obtener_rol_actual() IN ('vendedor', 'cajera') AND vendedor_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM despachos_pedidos dp
      JOIN despachos d ON d.id = dp.despacho_id
      WHERE dp.pedido_id = pedidos_cabecera.id
        AND d.repartidor_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. pedidos_detalle: mismo alcance que su cabecera
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
          OR (obtener_rol_actual() IN ('vendedor', 'cajera') AND pc.vendedor_id = auth.uid())
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
-- 3. clientes: quick-add, listado y edición básica, igual que vendedor
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "clientes_insert_comercial" ON clientes;
CREATE POLICY "clientes_insert_comercial" ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera'));

DROP POLICY IF EXISTS "clientes_select_operativo" ON clientes;
CREATE POLICY "clientes_select_operativo" ON clientes
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'repartidor', 'cajera'));

DROP POLICY IF EXISTS "clientes_update_comercial" ON clientes;
CREATE POLICY "clientes_update_comercial" ON clientes
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'cajera'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'cajera'));

-- ----------------------------------------------------------------------------
-- 4. productos: catálogo de lectura para armar el carrito
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "productos_select_operativo" ON productos;
CREATE POLICY "productos_select_operativo" ON productos
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'repartidor', 'cajera'));

-- ----------------------------------------------------------------------------
-- 5. resolver_precio_pedido: cajera puede usar precio frío y a crédito
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolver_precio_pedido(
  p_producto_id UUID,
  p_nombre TEXT,
  p_precio_venta NUMERIC,
  p_precio_frio NUMERIC,
  p_cantidad NUMERIC,
  p_tipo_precio TEXT,
  p_precio_credito NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT := obtener_rol_actual();
  v_precio NUMERIC;
BEGIN
  IF p_tipo_precio IS NULL OR p_tipo_precio = 'normal' THEN
    RETURN p_precio_venta;
  END IF;

  IF p_tipo_precio = 'mayorista' THEN
    SELECT precio INTO v_precio
      FROM productos_precios_mayoristas
      WHERE producto_id = p_producto_id AND estado = true AND eliminado IS NULL
        AND cantidad_minima <= p_cantidad
      ORDER BY cantidad_minima DESC
      LIMIT 1;

    IF v_precio IS NOT NULL THEN
      RETURN v_precio;
    END IF;

    IF v_rol NOT IN ('soporte', 'gerencia') THEN
      RAISE EXCEPTION 'No tienes permiso para forzar el precio al por mayor sin alcanzar la cantidad mínima de ninguna franja.';
    END IF;

    SELECT precio INTO v_precio
      FROM productos_precios_mayoristas
      WHERE producto_id = p_producto_id AND estado = true AND eliminado IS NULL
      ORDER BY cantidad_minima ASC
      LIMIT 1;

    IF v_precio IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precios al por mayor configurados.', p_nombre;
    END IF;

    RETURN v_precio;
  END IF;

  IF p_tipo_precio = 'frio' THEN
    IF v_rol NOT IN ('soporte', 'gerencia', 'despachador', 'cajera') THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar precio frío.';
    END IF;
    IF p_precio_frio IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio frío configurado.', p_nombre;
    END IF;
    RETURN p_precio_frio;
  END IF;

  IF p_tipo_precio = 'credito' THEN
    IF v_rol NOT IN ('soporte', 'gerencia', 'despachador', 'cajera') THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar precio a crédito.';
    END IF;
    IF p_precio_credito IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio a crédito configurado.', p_nombre;
    END IF;
    RETURN p_precio_credito;
  END IF;

  RAISE EXCEPTION 'Tipo de precio inválido: %', p_tipo_precio;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. crear_pedido_transaccional: acepta cajera y la hace nacer 'entregado'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB
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
  v_tipo_precio TEXT;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_pedido TEXT;
  v_pedido_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_estado_inicial TEXT := 'pendiente';
  v_fecha_entrega TIMESTAMPTZ := NULL;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera') THEN
    RAISE EXCEPTION 'No tienes permiso para crear pedidos.';
  END IF;

  IF obtener_rol_actual() IN ('vendedor', 'despachador', 'cajera') THEN
    p_vendedor_id := auth.uid();
  END IF;

  -- Venta directa en punto de venta: entrega inmediata, sin pasar por
  -- despachos/despachos_pedidos. Ver comentario de cabecera de esta
  -- migración.
  IF obtener_rol_actual() = 'cajera' THEN
    v_estado_inicial := 'entregado';
    v_fecha_entrega := NOW();
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, disponible, precio_venta, iva, inc, precio_frio, precio_credito
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

    v_precio := resolver_precio_pedido(
      v_producto.id, v_producto.nombre, v_producto.precio_venta,
      v_producto.precio_frio, v_cantidad, v_tipo_precio, v_producto.precio_credito
    );
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea,
      'tipo_precio', v_tipo_precio
    );

    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  SELECT COALESCE(MAX(numero_pedido::INTEGER), 0) + 1
    INTO v_numero_pedido
    FROM pedidos_cabecera
    WHERE numero_pedido ~ '^[0-9]+$';

  IF v_numero_pedido IS NULL THEN
    v_numero_pedido := '1';
  END IF;

  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado, fecha_entrega)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, v_estado_inicial, v_fecha_entrega)
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio
  )
  SELECT
    v_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio'
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
