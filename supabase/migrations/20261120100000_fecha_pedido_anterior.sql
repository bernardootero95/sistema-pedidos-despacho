-- ============================================================================
-- Fecha del pedido en días anteriores (solo soporte/gerencia)
-- ============================================================================
-- Hasta ahora `pedidos_cabecera.fecha_pedido` siempre quedaba con NOW() (el
-- DEFAULT de la columna). Algunas empresas digitan después pedidos que se
-- tomaron en papel en días anteriores, y necesitan que el pedido quede con su
-- fecha real (informes de ventas, dashboard, listados).
--
-- crear_pedido_transaccional recibe un nuevo parámetro opcional
-- `p_fecha_pedido DATE`:
--   - NULL o el día de hoy → NOW(), igual que antes (cualquier rol).
--   - Un día anterior → solo soporte y gerencia; queda ese día con la hora
--     actual del negocio (America/Bogota), así los pedidos digitados en
--     orden conservan su orden dentro del día.
--   - Un día futuro → se rechaza.
-- No hay límite hacia atrás (decisión del usuario).
--
-- La venta directa (cajera) no puede cambiar la fecha, así que su
-- fecha_entrega = NOW() sigue siendo coherente con la fecha del pedido.
--
-- Mismo cuerpo que 20261009100000_precio_manual_en_pedidos.sql salvo el
-- manejo de la fecha. Cambia la firma, así que se elimina la anterior y se
-- vuelven a aplicar los permisos (sin esto PostgREST vería dos sobrecargas).
-- ============================================================================

DROP FUNCTION IF EXISTS crear_pedido_transaccional(UUID, UUID, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB,
  p_pagos JSONB DEFAULT NULL, -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...] solo venta directa
  p_fecha_pedido DATE DEFAULT NULL -- día del pedido; NULL = hoy
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT := obtener_rol_actual();
  v_zona_horaria CONSTANT TEXT := 'America/Bogota';
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_fecha_pedido TIMESTAMPTZ := NOW();
  v_item JSONB;
  v_producto RECORD;
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
  v_precio_manual NUMERIC;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_pedido TEXT;
  v_pedido_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_estado_inicial TEXT := 'pendiente';
  v_fecha_entrega TIMESTAMPTZ := NULL;
BEGIN
  IF v_rol NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera') THEN
    RAISE EXCEPTION 'No tienes permiso para crear pedidos.';
  END IF;

  IF p_fecha_pedido IS NOT NULL AND p_fecha_pedido <> v_hoy THEN
    IF p_fecha_pedido > v_hoy THEN
      RAISE EXCEPTION 'La fecha del pedido no puede ser posterior a hoy.';
    END IF;

    IF v_rol NOT IN ('soporte', 'gerencia') THEN
      RAISE EXCEPTION 'No tienes permiso para registrar pedidos con fecha anterior.';
    END IF;

    v_fecha_pedido :=
      (p_fecha_pedido + (NOW() AT TIME ZONE v_zona_horaria)::TIME) AT TIME ZONE v_zona_horaria;
  END IF;

  IF v_rol IN ('vendedor', 'despachador', 'cajera') THEN
    p_vendedor_id := auth.uid();
  END IF;

  IF v_rol = 'cajera' THEN
    v_estado_inicial := 'entregado';
    v_fecha_entrega := NOW();
  ELSIF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    RAISE EXCEPTION 'Solo la venta directa registra pagos al crear el pedido.';
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
    v_tipo_precio_id := CASE
      WHEN v_tipo_precio = 'personalizado' THEN NULLIF(v_item->>'tipo_precio_id', '')::UUID
      ELSE NULL
    END;
    v_precio_manual := CASE
      WHEN v_tipo_precio = 'manual' THEN NULLIF(v_item->>'precio_manual', '')::NUMERIC
      ELSE NULL
    END;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF MOD((v_cantidad * 100)::INTEGER, 25) <> 0 THEN
      RAISE EXCEPTION 'La cantidad del producto % debe ser un número entero o con fracción .25, .5 o .75.', v_item->>'producto_id';
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

    IF v_tipo_precio = 'manual' THEN
      IF NOT puede_cambiar_precio_manual() THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el precio de venta.';
      END IF;

      IF v_precio_manual IS NULL OR v_precio_manual < 0 OR v_precio_manual > 9999999999 THEN
        RAISE EXCEPTION 'Precio inválido para el producto "%".', v_producto.nombre;
      END IF;

      v_precio := ROUND(v_precio_manual, 2);
    ELSE
      v_precio := resolver_precio_pedido(
        v_producto.id, v_producto.nombre, v_producto.precio_venta,
        v_cantidad, v_tipo_precio, v_tipo_precio_id
      );
    END IF;

    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea,
      'tipo_precio', v_tipo_precio,
      'tipo_precio_id', v_tipo_precio_id
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

  INSERT INTO pedidos_cabecera (
    cliente_id, vendedor_id, notas, total, numero_pedido, estado, fecha_entrega, fecha_pedido
  )
  VALUES (
    p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, v_estado_inicial, v_fecha_entrega, v_fecha_pedido
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio, tipo_precio_id
  )
  SELECT
    v_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio',
    NULLIF(d->>'tipo_precio_id', '')::UUID
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  -- La venta directa nace entregada: se cobra completa en este mismo acto.
  IF v_estado_inicial = 'entregado' THEN
    PERFORM cobrar_saldo_pedido(v_pedido_id, p_pagos);
  END IF;

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB, JSONB, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB, JSONB, DATE) FROM PUBLIC, anon;
