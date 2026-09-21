-- ============================================================================
-- BASELINE 02/04 -- Funciones (36) del esquema public
-- ============================================================================
-- Versión final de cada función, tomada de las migraciones de
-- supabase/migrations y verificada contra el demo (MD5 del cuerpo idéntico).
-- Requiere 01_esquema.sql. Ver supabase/baseline/README.md.
-- ============================================================================
SET check_function_bodies = false;

CREATE FUNCTION actualizar_estado_despacho_transaccional(
  p_despacho_id UUID,
  p_nuevo_estado TEXT,
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

CREATE OR REPLACE FUNCTION actualizar_fecha_entrega_pedido(
  p_pedido_id UUID,
  p_fecha_entrega TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para corregir la fecha de entrega de un pedido.';
  END IF;

  IF p_fecha_entrega IS NULL THEN
    RAISE EXCEPTION 'La fecha de entrega es obligatoria.';
  END IF;

  SELECT id, estado, fecha_pedido
    INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado <> 'entregado' THEN
    RAISE EXCEPTION 'Solo se puede corregir la fecha de entrega de un pedido ya entregado.';
  END IF;

  IF p_fecha_entrega > NOW() THEN
    RAISE EXCEPTION 'La fecha de entrega no puede ser futura.';
  END IF;

  IF p_fecha_entrega < v_pedido.fecha_pedido THEN
    RAISE EXCEPTION 'La fecha de entrega no puede ser anterior a la fecha del pedido.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  UPDATE pedidos_cabecera
    SET fecha_entrega = p_fecha_entrega,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object('id', p_pedido_id, 'fecha_entrega', p_fecha_entrega);
END;
$$;

CREATE OR REPLACE FUNCTION actualizar_precios_producto(
  p_id UUID,
  p_precio_venta NUMERIC
)
RETURNS productos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto productos;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para editar precios de productos.';
  END IF;

  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'El precio de venta debe ser mayor o igual a 0.';
  END IF;

  UPDATE productos
  SET
    precio_venta = p_precio_venta,
    actualizado = now()
  WHERE id = p_id AND eliminado IS NULL
  RETURNING * INTO v_producto;

  IF v_producto IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  RETURN v_producto;
END;
$$;

CREATE OR REPLACE FUNCTION actualizar_rol_usuario(p_user_id UUID, p_rol_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol de un usuario.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roles
    WHERE id = p_rol_id AND estado = true AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'El rol seleccionado no es válido.';
  END IF;

  UPDATE perfiles
  SET rol_id = p_rol_id
  WHERE id = p_user_id
  RETURNING row_to_json(perfiles.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."actualizar_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.actualizado = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION anular_compra_transaccional(
  p_compra_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_detalle RECORD;
  v_ultimo_costo NUMERIC;
BEGIN
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular la compra.';
  END IF;

  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para anular compras.';
  END IF;

  SELECT id, estado, total_pagado INTO v_compra
    FROM compras_cabecera
    WHERE id = p_compra_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe o fue eliminada.';
  END IF;

  IF v_compra.estado = 'anulada' THEN
    RAISE EXCEPTION 'La compra ya está anulada.';
  END IF;

  FOR v_detalle IN
    SELECT producto_id, cantidad
      FROM compras_detalle
      WHERE compra_id = p_compra_id
      ORDER BY producto_id
  LOOP
    UPDATE productos
      SET disponible = disponible - v_detalle.cantidad,
          actualizado = NOW()
      WHERE id = v_detalle.producto_id;

    SELECT cd.costo_unitario INTO v_ultimo_costo
      FROM compras_detalle cd
      JOIN compras_cabecera cc ON cc.id = cd.compra_id
      WHERE cd.producto_id = v_detalle.producto_id
        AND cc.estado = 'registrada'
        AND cc.id <> p_compra_id
      ORDER BY cc.fecha_compra DESC, cc.creado DESC
      LIMIT 1;

    UPDATE productos
      SET ultimo_costo = v_ultimo_costo
      WHERE id = v_detalle.producto_id;
  END LOOP;

  UPDATE compras_cabecera
    SET estado = 'anulada',
        notas = p_motivo,
        actualizado = NOW()
    WHERE id = p_compra_id;

  PERFORM devolver_pagos(NULL, p_compra_id, v_compra.total_pagado);

  RETURN jsonb_build_object(
    'id', p_compra_id,
    'estado', 'anulada',
    'devuelto', v_compra.total_pagado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

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

CREATE OR REPLACE FUNCTION bloquear_autoescalada_privilegios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    IF NEW.rol_id IS DISTINCT FROM OLD.rol_id THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar el rol de un usuario.';
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'No tienes permiso para activar/desactivar usuarios.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION bloquear_edicion_directa_despacho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.rpc_autorizado', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'El estado de un despacho solo se puede cambiar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.vehiculo_id IS DISTINCT FROM OLD.vehiculo_id THEN
    RAISE EXCEPTION 'El vehículo de un despacho no se puede reasignar directamente.';
  END IF;
  IF NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id THEN
    RAISE EXCEPTION 'El repartidor de un despacho no se puede reasignar directamente.';
  END IF;
  IF NEW.fecha_despacho IS DISTINCT FROM OLD.fecha_despacho THEN
    RAISE EXCEPTION 'La fecha de un despacho no se puede modificar directamente.';
  END IF;
  IF NEW.codigo_despacho IS DISTINCT FROM OLD.codigo_despacho THEN
    RAISE EXCEPTION 'El código de despacho no se puede modificar.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION bloquear_edicion_directa_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.rpc_autorizado', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.total IS DISTINCT FROM OLD.total THEN
    RAISE EXCEPTION 'El total de un pedido solo se puede modificar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.total_pagado IS DISTINCT FROM OLD.total_pagado THEN
    RAISE EXCEPTION 'Los pagos de un pedido solo se pueden registrar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    RAISE EXCEPTION 'El cliente de un pedido no se puede reasignar directamente.';
  END IF;
  IF NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id THEN
    RAISE EXCEPTION 'El vendedor de un pedido no se puede reasignar directamente.';
  END IF;
  IF NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido THEN
    RAISE EXCEPTION 'El número de pedido no se puede modificar.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cobrar_saldo_pedido(
  p_pedido_id UUID,
  p_pagos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC;
  v_metodos_activo BOOLEAN;
  v_cobrado NUMERIC;
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
BEGIN
  SELECT COALESCE(total, 0) - total_pagado INTO v_saldo
    FROM pedidos_cabecera
    WHERE id = p_pedido_id;

  IF v_saldo <= 0 THEN
    IF v_hay_pagos THEN
      RAISE EXCEPTION 'El pedido ya está pagado por completo; no hay saldo por cobrar.';
    END IF;
    RETURN;
  END IF;

  SELECT metodos_pago_activo INTO v_metodos_activo FROM configuracion_sistema;

  IF NOT v_hay_pagos THEN
    IF v_metodos_activo THEN
      RAISE EXCEPTION 'Debe registrar el pago del saldo pendiente (%) antes de entregar.', v_saldo;
    END IF;
    p_pagos := jsonb_build_array(jsonb_build_object('monto', v_saldo));
  END IF;

  v_cobrado := registrar_pagos(p_pedido_id, NULL, 'entrega', p_pagos);

  IF v_cobrado <> v_saldo THEN
    RAISE EXCEPTION 'El pago debe cubrir exactamente el saldo pendiente (%). Se recibió %.', v_saldo, v_cobrado;
  END IF;
END;
$$;

CREATE FUNCTION crear_compra_transaccional(
  p_proveedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB, -- [{ "producto_id": "...", "cantidad": 10, "costo_unitario": 1500 }, ...]
  p_fecha_compra TIMESTAMPTZ DEFAULT NULL,
  p_pagos JSONB DEFAULT NULL -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...]
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
  v_costo_unitario NUMERIC(12,2);
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_compra TEXT;
  v_compra_id UUID;
  v_fecha_compra TIMESTAMPTZ;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_config RECORD;
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
  v_pagado NUMERIC := 0;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar compras.';
  END IF;

  IF p_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un proveedor.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La compra debe contener al menos un producto.';
  END IF;

  v_fecha_compra := COALESCE(p_fecha_compra, NOW());
  IF v_fecha_compra > NOW() THEN
    RAISE EXCEPTION 'La fecha de la compra no puede ser futura.';
  END IF;

  SELECT metodos_pago_activo, abonos_compras_activo INTO v_config FROM configuracion_sistema;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_costo_unitario := (v_item->>'costo_unitario')::NUMERIC;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF v_costo_unitario IS NULL OR v_costo_unitario < 0 THEN
      RAISE EXCEPTION 'Costo unitario inválido para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    v_subtotal_linea := v_costo_unitario * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'costo_unitario', v_costo_unitario,
      'subtotal_linea', v_subtotal_linea
    );

    UPDATE productos
      SET disponible = disponible + v_cantidad,
          ultimo_costo = v_costo_unitario,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  SELECT COALESCE(MAX(numero_compra::INTEGER), 0) + 1
    INTO v_numero_compra
    FROM compras_cabecera
    WHERE numero_compra ~ '^[0-9]+$';

  IF v_numero_compra IS NULL THEN
    v_numero_compra := '1';
  END IF;

  INSERT INTO compras_cabecera (numero_compra, proveedor_id, usuario_id, notas, total, fecha_compra)
  VALUES (v_numero_compra, p_proveedor_id, auth.uid(), p_notas, v_total, v_fecha_compra)
  RETURNING id INTO v_compra_id;

  INSERT INTO compras_detalle (
    compra_id, producto_id, cantidad, costo_unitario, subtotal_linea
  )
  SELECT
    v_compra_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'costo_unitario')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  IF v_total > 0 THEN
    IF v_config.abonos_compras_activo THEN
      IF v_hay_pagos THEN
        v_pagado := registrar_pagos(NULL, v_compra_id, 'pago', p_pagos);
        IF v_pagado > v_total THEN
          RAISE EXCEPTION 'El pago (%) supera el total de la compra (%).', v_pagado, v_total;
        END IF;
      END IF;
    ELSE
      IF NOT v_hay_pagos THEN
        IF v_config.metodos_pago_activo THEN
          RAISE EXCEPTION 'Debe registrar el pago de la compra (%).', v_total;
        END IF;
        p_pagos := jsonb_build_array(jsonb_build_object('monto', v_total));
      END IF;

      v_pagado := registrar_pagos(NULL, v_compra_id, 'pago', p_pagos);
      IF v_pagado <> v_total THEN
        RAISE EXCEPTION 'El pago debe cubrir exactamente el total de la compra (%). Se recibió %.', v_total, v_pagado;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_compra_id,
    'numero_compra', v_numero_compra,
    'total', v_total,
    'saldo', v_total - v_pagado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_pedido RECORD;
  v_despacho_id UUID;
  v_codigo_despacho TEXT;
  v_siguiente_numero INTEGER;
BEGIN
  IF p_vehiculo_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un vehículo.';
  END IF;

  IF p_repartidor_id IS NULL THEN
    RAISE EXCEPTION 'Debe asignar un conductor/repartidor.';
  END IF;

  IF p_pedidos_ids IS NULL OR array_length(p_pedidos_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe asignar al menos un pedido a la ruta.';
  END IF;

  -- 1. Bloquear el vehículo y verificar que no tenga ya un despacho activo
  --    (evita que quede "en dos rutas a la vez"; el FOR UPDATE evita que
  --    dos despachadores se lo asignen al mismo tiempo)
  PERFORM 1 FROM vehiculos WHERE id = p_vehiculo_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM despachos
    WHERE vehiculo_id = p_vehiculo_id
      AND estado IN ('creado', 'en_ruta')
      AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Este vehículo ya tiene un despacho activo. Debe completarse o anularse antes de asignarle una nueva ruta.';
  END IF;

  -- 2. Bloquear y validar cada pedido (evita doble asignación concurrente
  --    por dos despachadores trabajando al mismo tiempo)
  FOR v_pedido IN
    SELECT id, numero_pedido, estado
      FROM pedidos_cabecera
      WHERE id = ANY(p_pedidos_ids)
        AND eliminado IS NULL
      ORDER BY id
      FOR UPDATE
  LOOP
    IF v_pedido.estado <> 'pendiente' THEN
      RAISE EXCEPTION 'El pedido % ya no está pendiente (estado actual: %). Puede que otro despachador ya lo haya asignado.',
        v_pedido.numero_pedido, v_pedido.estado;
    END IF;
  END LOOP;

  -- Verificar que todos los IDs enviados existan (evita ids "fantasma")
  IF (SELECT COUNT(*) FROM pedidos_cabecera WHERE id = ANY(p_pedidos_ids) AND eliminado IS NULL)
     <> array_length(p_pedidos_ids, 1) THEN
    RAISE EXCEPTION 'Uno o más pedidos seleccionados ya no existen o fueron eliminados.';
  END IF;

  -- 3. Generar consecutivo del despacho (DSP-0001, DSP-0002, ...)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_despacho, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO v_siguiente_numero
    FROM despachos;

  v_codigo_despacho := 'DSP-' || LPAD(v_siguiente_numero::TEXT, 4, '0');

  -- 4. Insertar cabecera del despacho
  INSERT INTO despachos (
    codigo_despacho, vehiculo_id, repartidor_id, fecha_despacho, notas, estado
  ) VALUES (
    v_codigo_despacho, p_vehiculo_id, p_repartidor_id, p_fecha_despacho, p_notas, 'creado'
  )
  RETURNING id INTO v_despacho_id;

  -- 5. Insertar el detalle (pedidos asignados a la ruta)
  INSERT INTO despachos_pedidos (despacho_id, pedido_id, estado_entrega)
  SELECT v_despacho_id, unnest(p_pedidos_ids), 'pendiente';

  -- 6. Marcar los pedidos como despachados
  UPDATE pedidos_cabecera
    SET estado = 'despachado', actualizado = NOW()
    WHERE id = ANY(p_pedidos_ids);

  RETURN jsonb_build_object(
    'id', v_despacho_id,
    'codigo_despacho', v_codigo_despacho
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$_$;

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

CREATE OR REPLACE FUNCTION despacho_incluye_pedido_de_vendedor(p_despacho_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM despachos_pedidos dp
    JOIN pedidos_cabecera pc ON pc.id = dp.pedido_id
    WHERE dp.despacho_id = p_despacho_id
      AND pc.vendedor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION devolver_pagos(
  p_pedido_id UUID,
  p_compra_id UUID,
  p_monto NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante NUMERIC := p_monto;
  v_metodo RECORD;
  v_devolver NUMERIC;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN;
  END IF;

  FOR v_metodo IN
    SELECT metodo_pago_id,
           SUM(CASE WHEN tipo = 'devolucion' THEN -monto ELSE monto END) AS neto
      FROM pagos
      WHERE (p_pedido_id IS NOT NULL AND pedido_id = p_pedido_id)
         OR (p_compra_id IS NOT NULL AND compra_id = p_compra_id)
      GROUP BY metodo_pago_id
      HAVING SUM(CASE WHEN tipo = 'devolucion' THEN -monto ELSE monto END) > 0
      ORDER BY MAX(creado) DESC
  LOOP
    v_devolver := LEAST(v_restante, v_metodo.neto);
    INSERT INTO pagos (pedido_id, compra_id, metodo_pago_id, tipo, monto)
    VALUES (p_pedido_id, p_compra_id, v_metodo.metodo_pago_id, 'devolucion', v_devolver);

    v_restante := v_restante - v_devolver;
    EXIT WHEN v_restante <= 0;
  END LOOP;
END;
$$;

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

CREATE OR REPLACE FUNCTION "public"."hook_password_verification_attempt"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user_id uuid := (event->>'user_id')::uuid;
  v_valid boolean := (event->>'valid')::boolean;
  v_intentos integer;
  v_primer_intento timestamptz;
  v_bloqueado_hasta timestamptz;
  v_existe boolean;
  v_max_intentos constant integer := 5;
  v_ventana constant interval := interval '15 minutes';
  v_bloqueo constant interval := interval '15 minutes';
begin
  select intentos, primer_intento_en, bloqueado_hasta
    into v_intentos, v_primer_intento, v_bloqueado_hasta
    from public.auth_intentos_fallidos
    where user_id = v_user_id
    for update;

  v_existe := found;

  -- Cuenta bloqueada vigente: rechaza incluso si la contraseña es correcta,
  -- para que no sirva de nada probar credenciales durante el bloqueo.
  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en unos minutos.'
    );
  end if;

  if v_valid then
    delete from public.auth_intentos_fallidos where user_id = v_user_id;
    return jsonb_build_object('decision', 'continue');
  end if;

  if not v_existe or now() - v_primer_intento > v_ventana then
    insert into public.auth_intentos_fallidos (user_id, intentos, primer_intento_en, bloqueado_hasta)
      values (v_user_id, 1, now(), null)
      on conflict (user_id) do update
        set intentos = 1, primer_intento_en = now(), bloqueado_hasta = null;
  else
    update public.auth_intentos_fallidos
      set intentos = intentos + 1,
          bloqueado_hasta = case
            when intentos + 1 >= v_max_intentos then now() + v_bloqueo
            else null
          end
      where user_id = v_user_id;
  end if;

  -- Deja que Supabase Auth aplique su comportamiento normal para el intento
  -- fallido (mensaje genérico de "Invalid login credentials").
  return jsonb_build_object('decision', 'continue');
end;
$$;

CREATE OR REPLACE FUNCTION importar_productos_excel(p_productos JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_codigo TEXT;
  v_nombre TEXT;
  v_precio NUMERIC;
  v_disponible NUMERIC(12,2);
  v_reservado NUMERIC(12,2);
  v_creados INTEGER := 0;
  v_actualizados INTEGER := 0;
BEGIN
  IF obtener_rol_actual() <> 'soporte' THEN
    RAISE EXCEPTION 'No tienes permiso para importar productos.';
  END IF;

  IF p_productos IS NULL OR jsonb_array_length(p_productos) = 0 THEN
    RAISE EXCEPTION 'No se recibió ningún producto para importar.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_productos)
  LOOP
    v_codigo := NULLIF(trim(v_item->>'codigo'), '');
    v_nombre := NULLIF(trim(v_item->>'nombre'), '');
    v_precio := (v_item->>'precio_venta')::NUMERIC;
    v_disponible := (v_item->>'disponible')::NUMERIC;

    IF v_codigo IS NULL THEN
      RAISE EXCEPTION 'Hay un producto sin código en el archivo.';
    END IF;
    IF v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'Valor total inválido para el producto "%".', v_codigo;
    END IF;
    IF v_disponible IS NULL OR v_disponible < 0 THEN
      RAISE EXCEPTION 'Existencia inválida para el producto "%".', v_codigo;
    END IF;

    SELECT COALESCE(SUM(pd.cantidad), 0)
      INTO v_reservado
      FROM pedidos_detalle pd
      JOIN pedidos_cabecera pc ON pc.id = pd.pedido_id
      JOIN productos p ON p.id = pd.producto_id
      WHERE p.codigo = v_codigo
        AND pc.estado IN ('pendiente', 'despachado');

    UPDATE productos
      SET disponible = v_disponible - v_reservado,
          precio_venta = v_precio,
          actualizado = NOW()
      WHERE codigo = v_codigo;

    IF FOUND THEN
      v_actualizados := v_actualizados + 1;
    ELSE
      IF v_nombre IS NULL THEN
        RAISE EXCEPTION 'El producto nuevo "%" no tiene nombre.', v_codigo;
      END IF;

      INSERT INTO productos (
        codigo, nombre, precio_venta, disponible, clasificacion, iva, inc
      )
      VALUES (v_codigo, v_nombre, v_precio, v_disponible, 'gravado', 19, 0);

      v_creados := v_creados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

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
        AND fecha_entrega::date = CURRENT_DATE
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'venta_real_mes', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND date_trunc('month', fecha_entrega) = date_trunc('month', CURRENT_DATE)
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
    'despachos_activos', (
      SELECT COUNT(*) FROM despachos
      WHERE eliminado IS NULL AND estado = 'en_ruta'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION obtener_rol_actual()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.nombre
  FROM perfiles p
  JOIN roles r ON r.id = p.rol_id
  WHERE p.id = auth.uid()
    AND p.estado = true
    AND p.eliminado IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION obtener_siguiente_codigo_producto()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT lpad((codigo::bigint + 1)::text, length(codigo), '0')
      FROM productos
      WHERE codigo ~ '^[0-9]+$'
      ORDER BY codigo::bigint DESC
      LIMIT 1
    ),
    '0001'
  );
$$;

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
    (
      SELECT COALESCE(SUM(pc.total), 0) FROM pedidos_cabecera pc
      WHERE pc.eliminado IS NULL AND pc.estado = 'entregado'
        AND pc.fecha_entrega::date = dia::date
        AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    ) AS venta_real,
    (
      SELECT COALESCE(SUM(pc.total), 0) FROM pedidos_cabecera pc
      WHERE pc.eliminado IS NULL AND pc.estado IN ('pendiente', 'despachado')
        AND pc.fecha_pedido::date = dia::date
        AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    ) AS preventa
  FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS dia
  ORDER BY dia;
END;
$$;

CREATE OR REPLACE FUNCTION proteger_metodo_efectivo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.es_efectivo AND (
    NEW.es_efectivo IS DISTINCT FROM OLD.es_efectivo
    OR NEW.estado IS DISTINCT FROM true
    OR NEW.eliminado IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El método de pago por defecto (Efectivo) no se puede desactivar ni eliminar.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION registrar_abono_compra(
  p_compra_id UUID,
  p_pagos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_abonado NUMERIC;
  v_saldo NUMERIC;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar abonos a compras.';
  END IF;

  SELECT id, estado, total, total_pagado INTO v_compra
    FROM compras_cabecera
    WHERE id = p_compra_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe o fue eliminada.';
  END IF;

  IF v_compra.estado <> 'registrada' THEN
    RAISE EXCEPTION 'Solo se pueden registrar abonos en compras registradas (actual: %).', v_compra.estado;
  END IF;

  v_saldo := v_compra.total - v_compra.total_pagado;

  IF v_saldo <= 0 THEN
    RAISE EXCEPTION 'La compra ya está pagada por completo.';
  END IF;

  v_abonado := registrar_pagos(NULL, p_compra_id, 'abono', p_pagos);

  IF v_abonado <= 0 THEN
    RAISE EXCEPTION 'Debe registrar al menos un pago.';
  END IF;

  IF v_abonado > v_saldo THEN
    RAISE EXCEPTION 'El abono (%) supera el saldo pendiente de la compra (%).', v_abonado, v_saldo;
  END IF;

  RETURN jsonb_build_object(
    'compra_id', p_compra_id,
    'abonado', v_abonado,
    'saldo', v_saldo - v_abonado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

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

CREATE OR REPLACE FUNCTION "public"."registrar_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    usr_id UUID;
BEGIN
    -- Intentar obtener el ID del usuario autenticado en Supabase Auth
    usr_id := auth.uid();
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos, usuario_id)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id::text, to_jsonb(NEW), usr_id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Evitar auditar si es un borrado lógico idéntico sin cambios
        IF NEW != OLD THEN
            INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (TG_TABLE_NAME, TG_OP, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), usr_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, usuario_id)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id::text, to_jsonb(OLD), usr_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_pagos(
  p_pedido_id UUID,
  p_compra_id UUID,
  p_tipo TEXT,
  p_pagos JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metodos_activo BOOLEAN;
  v_efectivo_id UUID;
  v_item JSONB;
  v_monto NUMERIC(12,2);
  v_metodo_id UUID;
  v_suma NUMERIC := 0;
BEGIN
  IF p_pagos IS NULL OR jsonb_typeof(p_pagos) <> 'array' THEN
    RAISE EXCEPTION 'Los pagos deben enviarse como una lista.';
  END IF;

  SELECT metodos_pago_activo INTO v_metodos_activo FROM configuracion_sistema;
  SELECT id INTO v_efectivo_id FROM metodos_pago WHERE es_efectivo AND eliminado IS NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagos)
  LOOP
    v_monto := round((v_item->>'monto')::NUMERIC, 2);
    IF v_monto IS NULL OR v_monto <= 0 THEN
      RAISE EXCEPTION 'Cada pago debe tener un monto mayor a 0.';
    END IF;

    IF v_metodos_activo THEN
      v_metodo_id := NULLIF(v_item->>'metodo_pago_id', '')::UUID;
      IF v_metodo_id IS NULL THEN
        RAISE EXCEPTION 'Debe seleccionar el método de pago de cada pago.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM metodos_pago
        WHERE id = v_metodo_id AND estado = true AND eliminado IS NULL
      ) THEN
        RAISE EXCEPTION 'El método de pago seleccionado no existe o está inactivo.';
      END IF;
    ELSE
      v_metodo_id := v_efectivo_id;
    END IF;

    INSERT INTO pagos (pedido_id, compra_id, metodo_pago_id, tipo, monto)
    VALUES (p_pedido_id, p_compra_id, v_metodo_id, p_tipo, v_monto);

    v_suma := v_suma + v_monto;
  END LOOP;

  RETURN v_suma;
END;
$$;

CREATE OR REPLACE FUNCTION resolver_precio_pedido(
  p_producto_id UUID,
  p_nombre TEXT,
  p_precio_venta NUMERIC,
  p_cantidad NUMERIC,
  p_tipo_precio TEXT,
  p_tipo_precio_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT := obtener_rol_actual();
  v_precio NUMERIC;
  v_roles_permitidos TEXT[];
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

  IF p_tipo_precio = 'personalizado' THEN
    IF p_tipo_precio_id IS NULL THEN
      RAISE EXCEPTION 'Falta indicar cuál tipo de precio se aplica.';
    END IF;

    SELECT roles_permitidos INTO v_roles_permitidos
      FROM tipos_precio
      WHERE id = p_tipo_precio_id AND estado = true AND eliminado IS NULL;

    IF v_roles_permitidos IS NULL THEN
      RAISE EXCEPTION 'El tipo de precio indicado no existe o está inactivo.';
    END IF;

    IF NOT (v_rol = ANY(v_roles_permitidos)) THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar este tipo de precio.';
    END IF;

    SELECT precio INTO v_precio
      FROM productos_precios
      WHERE producto_id = p_producto_id AND tipo_precio_id = p_tipo_precio_id
        AND estado = true AND eliminado IS NULL;

    IF v_precio IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene ese precio configurado.', p_nombre;
    END IF;

    RETURN v_precio;
  END IF;

  RAISE EXCEPTION 'Tipo de precio inválido: %', p_tipo_precio;
END;
$$;

CREATE OR REPLACE FUNCTION sincronizar_total_pagado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC := CASE WHEN NEW.tipo = 'devolucion' THEN -NEW.monto ELSE NEW.monto END;
  v_bandera_previa TEXT := current_setting('app.rpc_autorizado', true);
BEGIN
  IF NEW.pedido_id IS NOT NULL THEN
    PERFORM set_config('app.rpc_autorizado', 'true', true);
    UPDATE pedidos_cabecera
      SET total_pagado = total_pagado + v_delta
      WHERE id = NEW.pedido_id;
    PERFORM set_config('app.rpc_autorizado', COALESCE(v_bandera_previa, ''), true);
  ELSE
    UPDATE compras_cabecera
      SET total_pagado = total_pagado + v_delta
      WHERE id = NEW.compra_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION tiene_correo_recuperacion(p_nombre_usuario TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE nombre_usuario = lower(trim(p_nombre_usuario))
      AND correo IS NOT NULL
      AND estado = true
      AND eliminado IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION toggle_user_status(p_user_id UUID, p_new_status BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para activar/desactivar usuarios.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio estado de acceso.';
  END IF;

  UPDATE public.perfiles
  SET estado = p_new_status
  WHERE id = p_user_id
  RETURNING row_to_json(perfiles.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_vehiculos_modtime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.actualizado = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION vendedor_es_dueno_del_pedido(p_pedido_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pedidos_cabecera pc
    WHERE pc.id = p_pedido_id
      AND pc.vendedor_id = auth.uid()
  );
$$;
