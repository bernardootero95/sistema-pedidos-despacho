-- ============================================================================
-- Precio manual en la toma de pedidos (activable y por perfil)
-- ============================================================================
-- Hasta ahora el servidor recalculaba siempre el precio de cada línea desde
-- el catálogo (normal / mayorista / tipo de precio especial) y nunca aceptaba
-- uno enviado por quien llama. Algunas empresas necesitan poder cambiar el
-- precio al vender (descuentos puntuales, negociaciones). Esta migración
-- agrega un cuarto tipo de precio, 'manual', que cada empresa activa y
-- reparte por perfil desde la pantalla "Pagos y Facturación":
--
--   1. `configuracion_sistema.precio_manual_activo` (apagado por defecto: es
--      opt-in por empresa) y `precio_manual_roles` (perfiles autorizados;
--      por defecto soporte y gerencia).
--   2. `puede_cambiar_precio_manual()`: única regla de permiso, usada por los
--      dos RPC; la fuente de verdad es el servidor, no el cliente.
--   3. `pedidos_detalle.tipo_precio` admite 'manual' (sin tipo_precio_id).
--   4. crear_pedido_transaccional: una línea con tipo_precio 'manual' trae su
--      `precio_manual` y solo se acepta si puede_cambiar_precio_manual().
--   5. editar_pedido_transaccional: igual, y además cualquier rol puede
--      CONSERVAR un precio manual que el pedido ya tenía —solo si es
--      exactamente el mismo precio— aunque la opción se haya apagado o él no
--      tenga el perfil, pero no crear ni cambiar uno. Sin esto, editar
--      cualquier cosa de un pedido con precio manual (p. ej. el vendedor que
--      corrige la cantidad) fallaría.
--
-- Mismos cuerpos que 20260921110000_pagos_en_pedidos_y_despachos.sql; solo
-- cambia el cálculo del precio por línea. CREATE OR REPLACE conserva los
-- GRANT/REVOKE (las firmas no cambian).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuración: interruptor y perfiles autorizados
-- ----------------------------------------------------------------------------
ALTER TABLE configuracion_sistema
  ADD COLUMN IF NOT EXISTS precio_manual_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precio_manual_roles TEXT[] NOT NULL DEFAULT ARRAY['soporte', 'gerencia'];

-- Solo roles que pueden tomar pedidos: un valor suelto (p. ej. un rol
-- inexistente) quedaría guardado sin efecto y confundiría.
ALTER TABLE configuracion_sistema
  ADD CONSTRAINT configuracion_sistema_precio_manual_roles_check
  CHECK (precio_manual_roles <@ ARRAY['soporte', 'gerencia', 'vendedor', 'despachador', 'cajera']::TEXT[]);

-- La actualiza soporte/gerencia con la política de UPDATE ya existente de
-- configuracion_sistema (mismo mecanismo que el resto de interruptores).

CREATE OR REPLACE FUNCTION puede_cambiar_precio_manual()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.precio_manual_activo AND obtener_rol_actual() = ANY (c.precio_manual_roles)
       FROM configuracion_sistema c),
    false
  );
$$;

-- Uso interno de los RPC (SECURITY DEFINER); no se expone por la API.
REVOKE ALL ON FUNCTION puede_cambiar_precio_manual() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. CHECK de tipo_precio
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_detalle DROP CONSTRAINT chk_pedidos_detalle_tipo_precio;

ALTER TABLE pedidos_detalle
  ADD CONSTRAINT chk_pedidos_detalle_tipo_precio
  CHECK (
    tipo_precio IN ('normal', 'mayorista', 'personalizado', 'manual')
    AND ((tipo_precio = 'personalizado') = (tipo_precio_id IS NOT NULL))
  );

-- ----------------------------------------------------------------------------
-- 3. crear_pedido_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
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
  v_rol TEXT := obtener_rol_actual();
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

-- ----------------------------------------------------------------------------
-- 4. editar_pedido_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_pedido_transaccional(
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
  v_rol TEXT := obtener_rol_actual();
  v_pedido RECORD;
  v_item JSONB;
  v_producto RECORD;
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
  v_precio_manual NUMERIC;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_detalle_previo RECORD;
  v_manuales_previos JSONB;
  v_devuelto NUMERIC := 0;
BEGIN
  IF v_rol NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador') THEN
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

  -- Precios manuales que el pedido ya tenía (producto -> precio): un rol sin
  -- permiso puede conservarlos tal cual al editar, no cambiarlos.
  SELECT COALESCE(jsonb_object_agg(producto_id::TEXT, precio_unitario), '{}'::JSONB)
    INTO v_manuales_previos
    FROM pedidos_detalle
    WHERE pedido_id = p_pedido_id
      AND tipo_precio = 'manual';

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
      IF v_precio_manual IS NULL OR v_precio_manual < 0 OR v_precio_manual > 9999999999 THEN
        RAISE EXCEPTION 'Precio inválido para el producto "%".', v_producto.nombre;
      END IF;

      v_precio := ROUND(v_precio_manual, 2);

      IF (v_manuales_previos->>(v_producto.id::TEXT))::NUMERIC IS DISTINCT FROM v_precio
         AND NOT puede_cambiar_precio_manual() THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el precio de venta.';
      END IF;
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
