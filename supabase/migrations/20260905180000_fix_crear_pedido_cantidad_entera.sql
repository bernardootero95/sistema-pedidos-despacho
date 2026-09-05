-- ============================================================================
-- Fix: crear_pedido_transaccional volvió a exigir cantidad entera
-- ============================================================================
-- 20260830190000 (rol_cajera_venta_directa) recreó crear_pedido_transaccional
-- para agregar el flujo de cajera, pero partió de una copia de la función
-- previa a 20260827120000/20260827140000: v_cantidad quedó como INTEGER y
-- los casts ::INTEGER, perdiendo el soporte de fracciones de cuarto
-- (.25/.5/.75) solo en la ruta de CREAR pedido (editar_pedido_transaccional
-- no se tocó en esa migración, así que ahí sí seguía funcionando).
--
-- Efecto en producción: "Nuevo Pedido" con cantidad 0.5 fallaba con
-- "invalid input syntax for type integer: 0.5".
--
-- Se recrea la función igual a como quedó en 20260830190000 (rol cajera,
-- estado/fecha_entrega inmediatos) pero con v_cantidad NUMERIC(12,2), los
-- casts a NUMERIC y el mismo chequeo de fracción de cuarto que ya tiene
-- editar_pedido_transaccional.
-- ============================================================================

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
  v_cantidad NUMERIC(12,2);
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
  -- despachos/despachos_pedidos. Ver comentario de cabecera de
  -- 20260830190000.
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
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF MOD((v_cantidad * 100)::INTEGER, 25) <> 0 THEN
      RAISE EXCEPTION 'La cantidad del producto % debe ser un número entero o con fracción .25, .5 o .75.', v_item->>'producto_id';
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
    (d->>'cantidad')::NUMERIC,
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
