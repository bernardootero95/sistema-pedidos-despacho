-- ============================================================================
-- Pagos, abonos y saldo a proveedor en compras
-- ============================================================================
-- Sobre el esquema de 20260921100000_metodos_pago_y_pagos.sql:
--   - crear_compra_transaccional: registra el/los pagos al crear la compra.
--       * Con "abonos a compras" activo el pago inicial es opcional y puede
--         ser parcial (0..total): lo no pagado queda como saldo al proveedor.
--       * Con la opción apagada la compra se paga completa al registrarse
--         (con métodos de pago apagado, en Efectivo sin pedir nada, como
--         hasta ahora).
--   - registrar_abono_compra (nueva): abono posterior a una compra con saldo.
--       El interruptor gobierna si se pueden CREAR compras con saldo; abonar
--       una compra que ya lo tiene siempre está permitido, para que apagar
--       la opción no deje deudas imposibles de saldar.
--   - anular_compra_transaccional: devuelve automáticamente lo pagado (mismo
--       criterio acordado para anular pedidos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. crear_compra_transaccional (+ p_pagos)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ);

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
      -- Pago inicial opcional y parcial: el resto queda como saldo al proveedor.
      IF v_hay_pagos THEN
        v_pagado := registrar_pagos(NULL, v_compra_id, 'pago', p_pagos);
        IF v_pagado > v_total THEN
          RAISE EXCEPTION 'El pago (%) supera el total de la compra (%).', v_pagado, v_total;
        END IF;
      END IF;
    ELSE
      -- Sin abonos, la compra se paga completa al registrarla.
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

GRANT EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 2. registrar_abono_compra (nueva)
-- ----------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION registrar_abono_compra(UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION registrar_abono_compra(UUID, JSONB) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 3. anular_compra_transaccional: devuelve lo pagado
-- ----------------------------------------------------------------------------
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
