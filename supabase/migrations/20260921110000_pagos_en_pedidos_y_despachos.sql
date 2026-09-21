-- ============================================================================
-- Pagos en el ciclo de vida de pedidos y despachos
-- ============================================================================
-- Sobre el esquema de 20260921100000_metodos_pago_y_pagos.sql:
--   - crear_pedido_transaccional: la venta directa de la cajera (nace
--     'entregado') cobra el total al crearse.
--   - editar_pedido_transaccional: si el nuevo total queda por debajo de lo
--     abonado exige confirmación explícita y devuelve la diferencia.
--   - anular_pedido_transaccional: devuelve automáticamente lo pagado.
--   - registrar_abono_pedido (nueva): abono a un pedido pendiente/despachado
--     (solo soporte/gerencia, y solo con la opción activada).
--   - actualizar_estado_entrega_pedido_transaccional: al pasar a 'entregado'
--     cobra el saldo completo.
--   - actualizar_estado_despacho_transaccional: al completar la ruta cobra el
--     saldo de cada pedido pendiente de entrega (un solo diálogo en el
--     cliente con todos los saldos).
-- Rechazar o revertir una entrega NO toca los pagos (decisión acordada): el
-- saldo siempre se calcula como total - total_pagado.
-- Como cambian las listas de parámetros, se recrean con DROP + CREATE
-- (CREATE OR REPLACE no permite agregar parámetros sin dejar sobrecargas
-- ambiguas).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. crear_pedido_transaccional (+ p_pagos para la venta directa)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS crear_pedido_transaccional(UUID, UUID, TEXT, JSONB);

CREATE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB,
  p_pagos JSONB DEFAULT NULL -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...] solo venta directa
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
  v_tipo_precio_id UUID;
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

  IF obtener_rol_actual() = 'cajera' THEN
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

    v_precio := resolver_precio_pedido(
      v_producto.id, v_producto.nombre, v_producto.precio_venta,
      v_cantidad, v_tipo_precio, v_tipo_precio_id
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

  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado, fecha_entrega)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, v_estado_inicial, v_fecha_entrega)
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 2. editar_pedido_transaccional (+ p_confirmar_devolucion)
-- ----------------------------------------------------------------------------
-- Si el nuevo total queda por debajo de lo ya abonado, falla con SQLSTATE
-- 'PD001' (DETAIL = monto a devolver) salvo que el cliente confirme; al
-- fallar se revierte toda la edición, así que no queda nada a medias.
DROP FUNCTION IF EXISTS editar_pedido_transaccional(UUID, TEXT, JSONB);

CREATE FUNCTION editar_pedido_transaccional(
  p_pedido_id UUID,
  p_notas TEXT,
  p_detalles JSONB,
  p_confirmar_devolucion BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_producto RECORD;
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_detalle_previo RECORD;
  v_devuelto NUMERIC := 0;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para editar pedidos.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  SELECT id, estado, total_pagado INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden editar pedidos en estado pendiente (actual: %).', v_pedido.estado;
  END IF;

  FOR v_detalle_previo IN
    SELECT producto_id, cantidad FROM pedidos_detalle
    WHERE pedido_id = p_pedido_id
    ORDER BY producto_id
  LOOP
    UPDATE productos
      SET disponible = disponible + v_detalle_previo.cantidad,
          actualizado = NOW()
      WHERE id = v_detalle_previo.producto_id;
  END LOOP;

  DELETE FROM pedidos_detalle WHERE pedido_id = p_pedido_id;

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

    v_precio := resolver_precio_pedido(
      v_producto.id, v_producto.nombre, v_producto.precio_venta,
      v_cantidad, v_tipo_precio, v_tipo_precio_id
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
      'tipo_precio', v_tipo_precio,
      'tipo_precio_id', v_tipo_precio_id
    );

    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio, tipo_precio_id
  )
  SELECT
    p_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio',
    NULLIF(d->>'tipo_precio_id', '')::UUID
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  UPDATE pedidos_cabecera
    SET total = v_total,
        notas = p_notas,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  IF v_pedido.total_pagado > v_total THEN
    v_devuelto := v_pedido.total_pagado - v_total;

    IF NOT COALESCE(p_confirmar_devolucion, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'PD001',
        MESSAGE = format(
          'El nuevo total (%s) es menor a lo ya abonado (%s). Confirma para devolver la diferencia (%s).',
          v_total, v_pedido.total_pagado, v_devuelto
        ),
        DETAIL = v_devuelto::TEXT;
    END IF;

    PERFORM devolver_pagos(p_pedido_id, NULL, v_devuelto);
  END IF;

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'total', v_total,
    'devuelto', v_devuelto
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_pedido_transaccional(UUID, TEXT, JSONB, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION editar_pedido_transaccional(UUID, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 3. anular_pedido_transaccional: devuelve lo pagado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_pedido_transaccional(
  p_pedido_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_detalle RECORD;
BEGIN
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular el pedido.';
  END IF;

  SELECT id, estado, vendedor_id, total_pagado INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado = 'anulado' THEN
    RAISE EXCEPTION 'El pedido ya está anulado.';
  END IF;

  IF NOT (
    obtener_rol_actual() IN ('gerencia', 'soporte', 'despachador')
    OR (
      obtener_rol_actual() = 'vendedor'
      AND v_pedido.estado = 'pendiente'
      AND v_pedido.vendedor_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para anular este pedido.';
  END IF;

  IF v_pedido.estado IN ('pendiente', 'despachado') THEN
    FOR v_detalle IN
      SELECT producto_id, cantidad
        FROM pedidos_detalle
        WHERE pedido_id = p_pedido_id
        ORDER BY producto_id
    LOOP
      UPDATE productos
        SET disponible = disponible + v_detalle.cantidad,
            actualizado = NOW()
        WHERE id = v_detalle.producto_id;
    END LOOP;
  END IF;

  UPDATE pedidos_cabecera
    SET estado = 'anulado',
        notas = p_motivo,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  PERFORM devolver_pagos(p_pedido_id, NULL, v_pedido.total_pagado);

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'estado', 'anulado',
    'devuelto', v_pedido.total_pagado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. registrar_abono_pedido (nueva)
-- ----------------------------------------------------------------------------
CREATE FUNCTION registrar_abono_pedido(
  p_pedido_id UUID,
  p_pagos JSONB -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_abonado NUMERIC;
  v_saldo NUMERIC;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar abonos.';
  END IF;

  IF NOT (SELECT abonos_pedidos_activo FROM configuracion_sistema) THEN
    RAISE EXCEPTION 'Los abonos a pedidos no están habilitados.';
  END IF;

  SELECT id, estado, COALESCE(total, 0) AS total, total_pagado INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado NOT IN ('pendiente', 'despachado') THEN
    RAISE EXCEPTION 'Solo se pueden registrar abonos en pedidos pendientes o despachados (actual: %).', v_pedido.estado;
  END IF;

  v_saldo := v_pedido.total - v_pedido.total_pagado;

  v_abonado := registrar_pagos(p_pedido_id, NULL, 'abono', p_pagos);

  IF v_abonado <= 0 THEN
    RAISE EXCEPTION 'Debe registrar al menos un pago.';
  END IF;

  IF v_abonado > v_saldo THEN
    RAISE EXCEPTION 'El abono (%) supera el saldo pendiente del pedido (%).', v_abonado, v_saldo;
  END IF;

  RETURN jsonb_build_object(
    'pedido_id', p_pedido_id,
    'abonado', v_abonado,
    'saldo', v_saldo - v_abonado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_abono_pedido(UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION registrar_abono_pedido(UUID, JSONB) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 5. actualizar_estado_entrega_pedido_transaccional (+ p_pagos)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS actualizar_estado_entrega_pedido_transaccional(UUID, TEXT, TEXT);

CREATE FUNCTION actualizar_estado_entrega_pedido_transaccional(
  p_despacho_pedido_id UUID,
  p_nuevo_estado_entrega TEXT,
  p_notas_entrega TEXT DEFAULT NULL,
  p_pagos JSONB DEFAULT NULL -- cobro del saldo al marcar 'entregado'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_estado_despacho TEXT;
  v_estado_cabecera TEXT;
  v_estado_previo TEXT;
BEGIN
  IF obtener_rol_actual() NOT IN ('despachador', 'repartidor', 'gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar la entrega de un pedido.';
  END IF;

  IF p_nuevo_estado_entrega NOT IN ('pendiente', 'entregado', 'rechazado') THEN
    RAISE EXCEPTION 'Estado de entrega inválido: %', p_nuevo_estado_entrega;
  END IF;

  SELECT dp.pedido_id, d.estado
    INTO v_pedido_id, v_estado_despacho
    FROM despachos_pedidos dp
    JOIN despachos d ON d.id = dp.despacho_id
    WHERE dp.id = p_despacho_pedido_id
    FOR UPDATE OF dp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no está asignado a ningún despacho.';
  END IF;

  IF v_estado_despacho = 'anulado' THEN
    RAISE EXCEPTION 'No se puede modificar la entrega de un despacho anulado.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  IF p_nuevo_estado_entrega = 'entregado' THEN
    SELECT estado INTO v_estado_previo
      FROM pedidos_cabecera
      WHERE id = v_pedido_id
        AND eliminado IS NULL
      FOR UPDATE;

    IF v_estado_previo = 'anulado' THEN
      RAISE EXCEPTION 'El pedido está anulado; no se puede entregar.';
    END IF;

    -- Un clic repetido sobre un pedido ya entregado no vuelve a cobrar.
    IF v_estado_previo IS DISTINCT FROM 'entregado' THEN
      PERFORM cobrar_saldo_pedido(v_pedido_id, p_pagos);
    END IF;
  END IF;

  UPDATE despachos_pedidos
    SET estado_entrega = p_nuevo_estado_entrega,
        notas_entrega = COALESCE(p_notas_entrega, notas_entrega)
    WHERE id = p_despacho_pedido_id;

  v_estado_cabecera := CASE p_nuevo_estado_entrega
    WHEN 'entregado' THEN 'entregado'
    WHEN 'rechazado' THEN 'devuelto'
    ELSE 'despachado'
  END;

  UPDATE pedidos_cabecera
    SET estado = v_estado_cabecera,
        fecha_entrega = CASE WHEN v_estado_cabecera = 'entregado' THEN NOW() ELSE NULL END,
        actualizado = NOW()
    WHERE id = v_pedido_id
      AND eliminado IS NULL;

  RETURN jsonb_build_object(
    'despacho_pedido_id', p_despacho_pedido_id,
    'pedido_id', v_pedido_id,
    'estado_entrega', p_nuevo_estado_entrega,
    'estado_pedido', v_estado_cabecera
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_estado_entrega_pedido_transaccional(UUID, TEXT, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION actualizar_estado_entrega_pedido_transaccional(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 6. actualizar_estado_despacho_transaccional (+ p_pagos por pedido)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS actualizar_estado_despacho_transaccional(UUID, TEXT);

CREATE FUNCTION actualizar_estado_despacho_transaccional(
  p_despacho_id UUID,
  p_nuevo_estado TEXT,
  -- Al completar: [{ "pedido_id": "...", "pagos": [{ "metodo_pago_id": "...", "monto": 1000 }] }, ...]
  p_pagos JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_transiciones_validas TEXT[];
  v_pendiente RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('despachador', 'repartidor', 'gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el estado de un despacho.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  SELECT estado INTO v_estado_actual
    FROM despachos
    WHERE id = p_despacho_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El despacho no existe o fue eliminado.';
  END IF;

  v_transiciones_validas := CASE v_estado_actual
    WHEN 'creado' THEN ARRAY['en_ruta', 'anulado']
    WHEN 'en_ruta' THEN ARRAY['completado', 'anulado']
    ELSE ARRAY[]::TEXT[]
  END;

  IF NOT (p_nuevo_estado = ANY(v_transiciones_validas)) THEN
    RAISE EXCEPTION 'No se puede pasar el despacho de "%" a "%".', v_estado_actual, p_nuevo_estado;
  END IF;

  UPDATE despachos
    SET estado = p_nuevo_estado, actualizado_en = NOW()
    WHERE id = p_despacho_id;

  IF p_nuevo_estado = 'completado' THEN
    -- Cobra el saldo de cada pedido que pasa a entregado en este acto
    -- (orden estable por pedido para evitar bloqueos cruzados).
    FOR v_pendiente IN
      SELECT dp.pedido_id
        FROM despachos_pedidos dp
        JOIN pedidos_cabecera pc ON pc.id = dp.pedido_id
        WHERE dp.despacho_id = p_despacho_id
          AND dp.estado_entrega = 'pendiente'
          AND pc.eliminado IS NULL
        ORDER BY dp.pedido_id
    LOOP
      PERFORM 1 FROM pedidos_cabecera WHERE id = v_pendiente.pedido_id FOR UPDATE;

      PERFORM cobrar_saldo_pedido(
        v_pendiente.pedido_id,
        (
          SELECT e->'pagos'
            FROM jsonb_array_elements(COALESCE(p_pagos, '[]'::JSONB)) e
            WHERE e->>'pedido_id' = v_pendiente.pedido_id::TEXT
            LIMIT 1
        )
      );
    END LOOP;

    UPDATE despachos_pedidos
      SET estado_entrega = 'entregado'
      WHERE despacho_id = p_despacho_id
        AND estado_entrega = 'pendiente';

    UPDATE pedidos_cabecera pc
      SET estado = 'entregado',
          fecha_entrega = NOW(),
          actualizado = NOW()
      FROM despachos_pedidos dp
      WHERE dp.despacho_id = p_despacho_id
        AND dp.pedido_id = pc.id
        AND dp.estado_entrega = 'entregado'
        AND pc.eliminado IS NULL;

  ELSIF p_nuevo_estado = 'anulado' THEN
    UPDATE pedidos_cabecera pc
      SET estado = 'pendiente', actualizado = NOW()
      FROM despachos_pedidos dp
      WHERE dp.despacho_id = p_despacho_id
        AND dp.pedido_id = pc.id
        AND dp.estado_entrega = 'pendiente'
        AND pc.eliminado IS NULL;
  END IF;

  RETURN jsonb_build_object('id', p_despacho_id, 'estado', p_nuevo_estado);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_estado_despacho_transaccional(UUID, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION actualizar_estado_despacho_transaccional(UUID, TEXT, JSONB) FROM PUBLIC, anon;
