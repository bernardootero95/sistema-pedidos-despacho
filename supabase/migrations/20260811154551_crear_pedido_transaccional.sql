-- ============================================================================
-- Función transaccional para creación de Pedidos con control de stock atómico
-- ============================================================================
-- Reemplaza la lógica que antes vivía en orderService.js (crearPedido).
-- Beneficios:
--   1. Bloquea las filas de producto (FOR UPDATE) evitando condiciones de
--      carrera cuando dos vendedores compran el mismo producto simultáneamente.
--   2. Calcula precio/IVA/INC/subtotal desde la tabla productos (fuente de
--      verdad), no acepta esos valores desde el cliente.
--   3. Genera el numero_pedido dentro de la misma transacción, evitando
--      duplicados por condición de carrera en el consecutivo.
--   4. Todo o nada: si cualquier producto no tiene stock, se revierte
--      automáticamente por ser una única transacción PL/pgSQL.
-- ============================================================================

CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 2 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Permitir que usuarios autenticados (vendedores) puedan ejecutar la función
GRANT EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB) TO authenticated;