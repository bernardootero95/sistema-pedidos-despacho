-- ============================================================================
-- Precio manual también en las cotizaciones
-- ============================================================================
-- Continúa 20261009100000_precio_manual_en_pedidos.sql: la opción "Cambiar el
-- precio al vender" (activable y por perfil en Pagos y Facturación) ahora
-- también aplica al cotizar.
--
--   1. crear_cotizacion_transaccional: una línea con tipo_precio 'manual'
--      trae su `precio_manual` y solo se acepta si puede_cambiar_precio_manual().
--      `cotizaciones_detalle.tipo_precio` es VARCHAR(20) sin CHECK, así que no
--      hace falta tocar la tabla.
--   2. convertir_cotizacion_en_pedido: el pedido conserva el precio manual
--      cotizado. Ese precio ya se pactó con el cliente, así que se respeta
--      aunque después se haya apagado la opción o quien convierte no tenga el
--      perfil (si no, una cotización vigente quedaría imposible de convertir).
--      Para eso la conversión marca la transacción con `app.precio_manual_cotizado`
--      y puede_cambiar_precio_manual() lo reconoce; el valor solo vive dentro
--      de esa transacción y solo lo pone esta función, que solo toma líneas
--      ya guardadas de la cotización.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. puede_cambiar_precio_manual: reconoce la conversión de una cotización
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION puede_cambiar_precio_manual()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(current_setting('app.precio_manual_cotizado', true) = 'true', false)
      OR COALESCE(
           (SELECT c.precio_manual_activo AND obtener_rol_actual() = ANY (c.precio_manual_roles)
              FROM configuracion_sistema c),
           false
         );
$$;

-- ----------------------------------------------------------------------------
-- 2. crear_cotizacion_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_cotizacion_transaccional(
  p_cliente_id UUID,
  p_fecha_vencimiento DATE,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id", "cantidad", "tipo_precio", "tipo_precio_id", "precio_manual" }, ...]
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
  v_precio_manual NUMERIC;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Bogota')::date;
  v_numero TEXT;
  v_cotizacion_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para crear cotizaciones.';
  END IF;

  IF p_cliente_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = p_cliente_id AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Debe seleccionar un cliente válido.';
  END IF;

  IF p_fecha_vencimiento IS NULL OR p_fecha_vencimiento < v_hoy THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a hoy.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La cotización debe contener al menos un producto.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
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

    -- Mismo límite que un pedido, para que la cotización siempre se pueda convertir.
    IF MOD((v_cantidad * 100)::INTEGER, 25) <> 0 THEN
      RAISE EXCEPTION 'La cantidad del producto % debe ser un número entero o con fracción .25, .5 o .75.', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
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
  END LOOP;

  -- Serializa la numeración: dos cotizaciones simultáneas no pueden tomar el
  -- mismo número (además de la restricción UNIQUE como red de seguridad).
  PERFORM pg_advisory_xact_lock(hashtext('cotizaciones_numero'));

  SELECT (COALESCE(MAX(numero_cotizacion::INTEGER), 0) + 1)::TEXT
    INTO v_numero
    FROM cotizaciones_cabecera
    WHERE numero_cotizacion ~ '^[0-9]+$';

  INSERT INTO cotizaciones_cabecera (
    numero_cotizacion, cliente_id, usuario_id, fecha_vencimiento, notas, total
  )
  VALUES (v_numero, p_cliente_id, auth.uid(), p_fecha_vencimiento, NULLIF(trim(p_notas), ''), v_total)
  RETURNING id INTO v_cotizacion_id;

  INSERT INTO cotizaciones_detalle (
    cotizacion_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio, tipo_precio_id
  )
  SELECT
    v_cotizacion_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio',
    NULLIF(d->>'tipo_precio_id', '')::UUID
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_cotizacion_id,
    'numero_cotizacion', v_numero,
    'total', v_total
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. convertir_cotizacion_en_pedido
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convertir_cotizacion_en_pedido(p_cotizacion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion RECORD;
  v_detalles JSONB;
  v_pedido JSONB;
  v_pedido_id UUID;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para convertir cotizaciones en pedidos.';
  END IF;

  SELECT id, cliente_id, estado, fecha_vencimiento, total, numero_cotizacion
    INTO v_cotizacion
    FROM cotizaciones_cabecera
    WHERE id = p_cotizacion_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no existe o fue eliminada.';
  END IF;

  IF v_cotizacion.estado = 'convertida' THEN
    RAISE EXCEPTION 'La cotización ya fue convertida en pedido.';
  END IF;

  IF v_cotizacion.estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede convertir una cotización anulada.';
  END IF;

  IF v_cotizacion.fecha_vencimiento < (NOW() AT TIME ZONE 'America/Bogota')::date THEN
    RAISE EXCEPTION 'La cotización está vencida; crea una nueva cotización.';
  END IF;

  -- Las líneas de precio manual viajan con su precio cotizado; las demás se
  -- resuelven con el catálogo vigente, como cualquier pedido.
  SELECT jsonb_agg(
           jsonb_build_object(
             'producto_id', producto_id,
             'cantidad', cantidad,
             'tipo_precio', tipo_precio,
             'tipo_precio_id', tipo_precio_id
           ) || CASE
             WHEN tipo_precio = 'manual' THEN jsonb_build_object('precio_manual', precio_unitario)
             ELSE '{}'::JSONB
           END
           ORDER BY creado
         )
    INTO v_detalles
    FROM cotizaciones_detalle
    WHERE cotizacion_id = p_cotizacion_id;

  -- El precio manual cotizado se respeta aunque la opción ya esté apagada o
  -- quien convierte no tenga el perfil (ver cabecera). Solo dura esta
  -- transacción.
  PERFORM set_config('app.precio_manual_cotizado', 'true', true);

  v_pedido := crear_pedido_transaccional(
    v_cotizacion.cliente_id,
    auth.uid(),
    'Generado desde la cotización N° ' || v_cotizacion.numero_cotizacion,
    v_detalles
  );

  PERFORM set_config('app.precio_manual_cotizado', 'false', true);

  v_pedido_id := (v_pedido->>'id')::UUID;

  UPDATE cotizaciones_cabecera
    SET estado = 'convertida',
        pedido_id = v_pedido_id,
        actualizado = NOW()
    WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'numero_pedido', v_pedido->>'numero_pedido',
    'total_pedido', (v_pedido->>'total')::NUMERIC,
    'total_cotizado', v_cotizacion.total
  );
END;
$$;
