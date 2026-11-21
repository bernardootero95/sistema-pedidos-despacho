-- ============================================================================
-- Compras pendientes de recibir
-- ============================================================================
-- Hasta ahora toda compra sumaba stock y movía el costo promedio al
-- registrarse. Ahora la compra tiene un estado de recepción independiente
-- del estado del documento (`estado`: registrada/anulada):
--
--   * 'recibida' (por defecto): igual que antes, suma `disponible` y
--     promedia el costo al registrarse. fecha_recepcion = fecha_compra.
--   * 'pendiente': mercancía comprada que aún no llega. NO suma stock ni
--     mueve el costo; los pagos/abonos funcionan igual que en una recibida.
--
-- `recibir_compra_transaccional` pasa una pendiente a recibida y aplica en
-- ese momento el stock y el costo promedio, con la fecha de recepción que
-- elige el usuario (no futura ni anterior a la compra).
--
-- Decisiones acordadas con el usuario (2026-11-21):
--   * Pueden recibir los mismos roles de compras: soporte, gerencia,
--     despachador.
--   * Recibida es definitivo: no se devuelve a pendiente; si fue un error,
--     se anula la compra (que revierte stock y costo).
--   * El informe de inventario por rango ignora las pendientes y cuenta las
--     recibidas en su fecha de recepción (cuando entró de verdad a bodega).
--   * Anular una pendiente no toca stock ni costo (nunca los movió).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas de recepción
-- ----------------------------------------------------------------------------
ALTER TABLE compras_cabecera
  ADD COLUMN IF NOT EXISTS estado_recepcion VARCHAR(20) DEFAULT 'recibida' NOT NULL,
  ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recibido_por UUID REFERENCES perfiles(id);

-- Las compras existentes entraron a bodega el día de la compra.
UPDATE compras_cabecera
  SET fecha_recepcion = fecha_compra
  WHERE fecha_recepcion IS NULL;

ALTER TABLE compras_cabecera
  DROP CONSTRAINT IF EXISTS compras_cabecera_estado_recepcion_check,
  ADD CONSTRAINT compras_cabecera_estado_recepcion_check
    CHECK (estado_recepcion IN ('pendiente', 'recibida')),
  DROP CONSTRAINT IF EXISTS compras_cabecera_fecha_recepcion_check,
  ADD CONSTRAINT compras_cabecera_fecha_recepcion_check
    CHECK ((estado_recepcion = 'recibida') = (fecha_recepcion IS NOT NULL));

COMMENT ON COLUMN compras_cabecera.estado_recepcion IS
  'pendiente: comprada pero no ha llegado (no suma stock ni mueve costo). recibida: ya sumó stock y promedió el costo.';
COMMENT ON COLUMN compras_cabecera.fecha_recepcion IS
  'Fecha en que la mercancía entró a bodega; NULL mientras está pendiente. El informe de inventario cuenta la compra en esta fecha.';

-- Filtro por estado de recepción en el listado (las pendientes son pocas).
CREATE INDEX IF NOT EXISTS idx_compras_cabecera_pendientes
  ON compras_cabecera (fecha_compra DESC)
  WHERE estado_recepcion = 'pendiente' AND eliminado IS NULL;

-- ----------------------------------------------------------------------------
-- 2. aplicar_entrada_compra: suma stock y promedia el costo de una línea
-- ----------------------------------------------------------------------------
-- Extraído de crear_compra_transaccional (mismo cálculo) para reutilizarlo
-- al recibir una pendiente. Interno: solo lo llaman RPC SECURITY DEFINER.
CREATE OR REPLACE FUNCTION aplicar_entrada_compra(
  p_producto_id UUID,
  p_cantidad NUMERIC,
  p_costo_unitario NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_disponible NUMERIC;
  v_costo_actual NUMERIC;
BEGIN
  -- Libre ANTES de esta entrada, bajo bloqueo (una misma compra puede traer
  -- el producto en varias líneas: cada una promedia sobre la anterior).
  SELECT disponible INTO v_disponible
    FROM productos
    WHERE id = p_producto_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe.', p_producto_id;
  END IF;

  UPDATE productos
    SET disponible = disponible + p_cantidad,
        actualizado = NOW()
    WHERE id = p_producto_id;

  SELECT ultimo_costo INTO v_costo_actual
    FROM productos_costos
    WHERE producto_id = p_producto_id;

  INSERT INTO productos_costos (producto_id, ultimo_costo)
  VALUES (
    p_producto_id,
    calcular_costo_promedio(v_disponible, v_costo_actual, p_cantidad, p_costo_unitario)
  )
  ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
END;
$$;

REVOKE ALL ON FUNCTION aplicar_entrada_compra(UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. crear_compra_transaccional: nuevo parámetro p_estado_recepcion
-- ----------------------------------------------------------------------------
-- Cambia la firma, así que se elimina la anterior para no dejar una
-- sobrecarga ambigua en PostgREST. Mismo cuerpo que
-- 20261026100000_costo_promedio_ponderado.sql salvo los bloques "NUEVO".
DROP FUNCTION IF EXISTS crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ, JSONB);

CREATE OR REPLACE FUNCTION crear_compra_transaccional(
  p_proveedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB, -- [{ "producto_id": "...", "cantidad": 10, "costo_unitario": 1500 }, ...]
  p_fecha_compra TIMESTAMPTZ DEFAULT NULL,
  p_pagos JSONB DEFAULT NULL, -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...]
  p_estado_recepcion TEXT DEFAULT 'recibida' -- 'recibida' | 'pendiente'
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
  v_estado_recepcion TEXT := COALESCE(p_estado_recepcion, 'recibida');
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

  -- NUEVO
  IF v_estado_recepcion NOT IN ('recibida', 'pendiente') THEN
    RAISE EXCEPTION 'Estado de recepción inválido: %.', v_estado_recepcion;
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

    -- NUEVO: una pendiente no suma stock ni mueve el costo hasta recibirse.
    IF v_estado_recepcion = 'recibida' THEN
      PERFORM aplicar_entrada_compra(v_producto.id, v_cantidad, v_costo_unitario);
    END IF;
  END LOOP;

  SELECT COALESCE(MAX(numero_compra::INTEGER), 0) + 1
    INTO v_numero_compra
    FROM compras_cabecera
    WHERE numero_compra ~ '^[0-9]+$';

  IF v_numero_compra IS NULL THEN
    v_numero_compra := '1';
  END IF;

  INSERT INTO compras_cabecera (
    numero_compra, proveedor_id, usuario_id, notas, total, fecha_compra,
    estado_recepcion, fecha_recepcion, recibido_por
  )
  VALUES (
    v_numero_compra, p_proveedor_id, auth.uid(), p_notas, v_total, v_fecha_compra,
    v_estado_recepcion,
    CASE WHEN v_estado_recepcion = 'recibida' THEN v_fecha_compra END,
    CASE WHEN v_estado_recepcion = 'recibida' THEN auth.uid() END
  )
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
    'saldo', v_total - v_pagado,
    'estado_recepcion', v_estado_recepcion
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ, JSONB, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 4. RPC: recibir_compra_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recibir_compra_transaccional(
  p_compra_id UUID,
  p_fecha_recepcion TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_detalle RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para recibir compras.';
  END IF;

  IF p_fecha_recepcion IS NULL THEN
    RAISE EXCEPTION 'La fecha de recepción es obligatoria.';
  END IF;

  IF p_fecha_recepcion > NOW() THEN
    RAISE EXCEPTION 'La fecha de recepción no puede ser futura.';
  END IF;

  -- Bloquea la cabecera: dos clics simultáneos no pueden sumar el stock dos veces.
  SELECT id, estado, estado_recepcion, fecha_compra INTO v_compra
    FROM compras_cabecera
    WHERE id = p_compra_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe o fue eliminada.';
  END IF;

  IF v_compra.estado = 'anulada' THEN
    RAISE EXCEPTION 'La compra está anulada; no se puede recibir.';
  END IF;

  IF v_compra.estado_recepcion = 'recibida' THEN
    RAISE EXCEPTION 'La compra ya fue recibida.';
  END IF;

  -- Por día (no por instante): una compra registrada sin fecha guarda NOW()
  -- con hora, y recibirla ese mismo día no debe fallar.
  IF p_fecha_recepcion::date < v_compra.fecha_compra::date THEN
    RAISE EXCEPTION 'La fecha de recepción no puede ser anterior a la fecha de la compra.';
  END IF;

  FOR v_detalle IN
    SELECT producto_id, cantidad, costo_unitario
      FROM compras_detalle
      WHERE compra_id = p_compra_id
      ORDER BY producto_id, creado
  LOOP
    PERFORM aplicar_entrada_compra(v_detalle.producto_id, v_detalle.cantidad, v_detalle.costo_unitario);
  END LOOP;

  UPDATE compras_cabecera
    SET estado_recepcion = 'recibida',
        fecha_recepcion = p_fecha_recepcion,
        recibido_por = auth.uid(),
        actualizado = NOW()
    WHERE id = p_compra_id;

  RETURN jsonb_build_object(
    'id', p_compra_id,
    'estado_recepcion', 'recibida',
    'fecha_recepcion', p_fecha_recepcion
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION recibir_compra_transaccional(UUID, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION recibir_compra_transaccional(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 5. anular_compra_transaccional: una pendiente no revierte stock ni costo
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20261026100000_costo_promedio_ponderado.sql salvo los
-- bloques "NUEVO". Misma firma: CREATE OR REPLACE conserva los GRANT.
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
  v_disponible NUMERIC;
  v_costo_actual NUMERIC;
  v_costo_revertido NUMERIC;
BEGIN
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular la compra.';
  END IF;

  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para anular compras.';
  END IF;

  SELECT id, estado, estado_recepcion, total_pagado INTO v_compra
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

  -- NUEVO: solo una compra recibida sumó stock y movió el costo.
  IF v_compra.estado_recepcion = 'recibida' THEN
    FOR v_detalle IN
      SELECT producto_id, cantidad, costo_unitario
        FROM compras_detalle
        WHERE compra_id = p_compra_id
        ORDER BY producto_id
    LOOP
      SELECT disponible INTO v_disponible
        FROM productos
        WHERE id = v_detalle.producto_id
        FOR UPDATE;

      UPDATE productos
        SET disponible = disponible - v_detalle.cantidad,
            actualizado = NOW()
        WHERE id = v_detalle.producto_id;

      -- NUEVO: el respaldo es la última otra compra RECIBIDA (una pendiente
      -- nunca aportó su costo).
      SELECT cd.costo_unitario INTO v_ultimo_costo
        FROM compras_detalle cd
        JOIN compras_cabecera cc ON cc.id = cd.compra_id
        WHERE cd.producto_id = v_detalle.producto_id
          AND cc.estado = 'registrada'
          AND cc.estado_recepcion = 'recibida'
          AND cc.id <> p_compra_id
        ORDER BY cc.fecha_recepcion DESC, cc.creado DESC
        LIMIT 1;

      IF v_ultimo_costo IS NULL THEN
        -- Sin otra compra recibida del producto: costo desconocido.
        DELETE FROM productos_costos WHERE producto_id = v_detalle.producto_id;
      ELSE
        SELECT ultimo_costo INTO v_costo_actual
          FROM productos_costos
          WHERE producto_id = v_detalle.producto_id;

        v_costo_revertido := revertir_costo_promedio(
          v_disponible, v_costo_actual, v_detalle.cantidad, v_detalle.costo_unitario
        );

        INSERT INTO productos_costos (producto_id, ultimo_costo)
        VALUES (v_detalle.producto_id, COALESCE(v_costo_revertido, v_ultimo_costo))
        ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
      END IF;
    END LOOP;
  END IF;

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

-- ----------------------------------------------------------------------------
-- 6. obtener_informe_inventario: compras por fecha de recepción
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20261008100000_informe_inventario_y_toma_fisica.sql; solo
-- cambia el CTE `compras`: ignora pendientes y usa fecha_recepcion (el
-- cálculo hacia atrás parte de `disponible`, que solo incluye lo recibido).
CREATE OR REPLACE FUNCTION obtener_informe_inventario(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fin TIMESTAMPTZ;
  v_resultado JSONB;
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

  IF p_fecha_hasta - p_fecha_desde > 366 THEN
    RAISE EXCEPTION 'El rango del informe no puede superar un año.';
  END IF;

  IF p_fecha_hasta > (NOW() AT TIME ZONE p_zona_horaria)::date THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser futura.';
  END IF;

  v_inicio := p_fecha_desde::timestamp AT TIME ZONE p_zona_horaria;
  v_fin := (p_fecha_hasta + 1)::timestamp AT TIME ZONE p_zona_horaria;

  WITH pendiente_actual AS (
    SELECT d.producto_id, SUM(d.cantidad) AS cantidad
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado IN ('pendiente', 'despachado')
    GROUP BY d.producto_id
  ),
  compras AS (
    SELECT
      cd.producto_id,
      COALESCE(SUM(cd.cantidad) FILTER (WHERE cc.fecha_recepcion >= v_inicio AND cc.fecha_recepcion < v_fin), 0) AS en_rango,
      COALESCE(SUM(cd.cantidad) FILTER (WHERE cc.fecha_recepcion >= v_fin), 0) AS posteriores
    FROM compras_cabecera cc
    JOIN compras_detalle cd ON cd.compra_id = cc.id
    WHERE cc.eliminado IS NULL
      AND cc.estado = 'registrada'
      AND cc.estado_recepcion = 'recibida'
      AND cc.fecha_recepcion >= v_inicio
    GROUP BY cd.producto_id
  ),
  entregas AS (
    SELECT
      d.producto_id,
      COALESCE(SUM(d.cantidad) FILTER (WHERE c.fecha_entrega < v_fin), 0) AS en_rango,
      COALESCE(SUM(d.cantidad) FILTER (WHERE c.fecha_entrega >= v_fin), 0) AS posteriores
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado = 'entregado'
      AND c.fecha_entrega >= v_inicio
    GROUP BY d.producto_id
  ),
  ajustes AS (
    SELECT
      td.producto_id,
      COALESCE(SUM(td.diferencia) FILTER (WHERE tf.fecha_aplicacion < v_fin), 0) AS en_rango,
      COALESCE(SUM(td.diferencia) FILTER (WHERE tf.fecha_aplicacion >= v_fin), 0) AS posteriores
    FROM tomas_fisicas tf
    JOIN tomas_fisicas_detalle td ON td.toma_id = tf.id
    WHERE tf.eliminado IS NULL
      AND tf.estado = 'aplicada'
      AND tf.fecha_aplicacion >= v_inicio
      AND td.diferencia IS NOT NULL
    GROUP BY td.producto_id
  ),
  preventa AS (
    SELECT d.producto_id, SUM(d.cantidad) AS cantidad
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.fecha_pedido < v_fin
      AND (
        c.estado IN ('pendiente', 'despachado')
        OR (c.estado = 'entregado' AND c.fecha_entrega >= v_fin)
      )
    GROUP BY d.producto_id
  ),
  calculo AS (
    SELECT
      p.id AS producto_id,
      p.codigo,
      p.nombre,
      p.precio_venta,
      pcost.ultimo_costo AS costo_unitario,
      COALESCE(co.en_rango, 0) AS compras,
      COALESCE(en.en_rango, 0) AS ventas,
      COALESCE(aj.en_rango, 0) AS ajustes,
      COALESCE(pv.cantidad, 0) AS preventa,
      (p.disponible + COALESCE(pa.cantidad, 0))
        - COALESCE(co.posteriores, 0)
        + COALESCE(en.posteriores, 0)
        - COALESCE(aj.posteriores, 0) AS fisico_final
    FROM productos p
    LEFT JOIN productos_costos pcost ON pcost.producto_id = p.id
    LEFT JOIN pendiente_actual pa ON pa.producto_id = p.id
    LEFT JOIN compras co ON co.producto_id = p.id
    LEFT JOIN entregas en ON en.producto_id = p.id
    LEFT JOIN ajustes aj ON aj.producto_id = p.id
    LEFT JOIN preventa pv ON pv.producto_id = p.id
  ),
  filas AS (
    SELECT
      c.*,
      c.fisico_final - c.compras + c.ventas - c.ajustes AS inicial,
      c.fisico_final - c.preventa AS disponible
    FROM calculo c
    WHERE c.compras <> 0 OR c.ventas <> 0 OR c.ajustes <> 0
       OR c.preventa <> 0 OR c.fisico_final <> 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', f.producto_id,
        'codigo', f.codigo,
        'nombre', f.nombre,
        'inicial', f.inicial,
        'compras', f.compras,
        'ventas', f.ventas,
        'ajustes', f.ajustes,
        'fisico_final', f.fisico_final,
        'preventa', f.preventa,
        'disponible', f.disponible,
        'costo_unitario', f.costo_unitario,
        'precio_venta', f.precio_venta
      )
      ORDER BY f.nombre
    ),
    '[]'::jsonb
  )
  INTO v_resultado
  FROM filas f;

  RETURN v_resultado;
END;
$$;
