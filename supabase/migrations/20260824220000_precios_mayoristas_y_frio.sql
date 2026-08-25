-- ============================================================================
-- Precios especiales por producto: al por mayor (por franjas de cantidad)
-- y "frío" (para productos que se venden fríos a otro precio)
-- ============================================================================
-- Reglas de negocio (definidas con el cliente):
--   - Un producto puede tener VARIAS franjas de precio al por mayor (ej.
--     10+ unidades a $900, 50+ a $850), no un único umbral fijo. Se aplica
--     la franja de mayor cantidad_minima que la cantidad del pedido
--     alcance; si se fuerza mayorista sin alcanzar ninguna franja, se usa
--     la más económica disponible.
--   - El precio frío es un único precio alterno por producto (no por
--     franjas), para productos parametrizados explícitamente con él.
--   - Solo soporte/gerencia pueden aplicar precio al por mayor.
--   - Precio frío lo pueden aplicar soporte/gerencia/despachador (NO
--     vendedor) — a diferencia del mayorista, el despachador sí lo ve al
--     facturar.
--   - El precio real SIEMPRE se recalcula en el servidor desde
--     productos/productos_precios_mayoristas; el cliente solo indica qué
--     tipo de precio pidió por línea (normal/mayorista/frio), nunca un
--     monto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Precio frío: precio alterno único por producto, opcional.
-- ----------------------------------------------------------------------------
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_frio NUMERIC(12,2);

ALTER TABLE productos
  ADD CONSTRAINT chk_productos_precio_frio CHECK (precio_frio IS NULL OR precio_frio >= 0);

-- ----------------------------------------------------------------------------
-- 2. Franjas de precio al por mayor: varias por producto, por cantidad
--    mínima. Mismo patrón estado/creado/actualizado/eliminado que el resto
--    de tablas del proyecto.
-- ----------------------------------------------------------------------------
CREATE TABLE productos_precios_mayoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad_minima INTEGER NOT NULL CHECK (cantidad_minima > 0),
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  estado BOOLEAN DEFAULT true,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  eliminado TIMESTAMPTZ
);

-- Única por producto+franja, pero solo entre franjas activas: así al
-- "reemplazar" las franjas de un producto desde el form se puede volver a
-- usar una cantidad_minima que antes existió y fue eliminada.
CREATE UNIQUE INDEX productos_precios_mayoristas_producto_cantidad_key
  ON productos_precios_mayoristas (producto_id, cantidad_minima)
  WHERE eliminado IS NULL;

CREATE TRIGGER set_timestamp_productos_precios_mayoristas
  BEFORE UPDATE ON productos_precios_mayoristas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE productos_precios_mayoristas ENABLE ROW LEVEL SECURITY;

-- Ni vendedor ni despachador necesitan ver las franjas: no las aplican
-- directamente, el servidor las resuelve por ellos vía resolver_precio_pedido.
CREATE POLICY "precios_mayoristas_select_admin" ON productos_precios_mayoristas
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "precios_mayoristas_write_admin" ON productos_precios_mayoristas
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

GRANT ALL ON TABLE productos_precios_mayoristas TO authenticated;
REVOKE ALL ON TABLE productos_precios_mayoristas FROM anon;

-- ----------------------------------------------------------------------------
-- 3. Trazabilidad: qué tipo de precio se usó en cada línea de un pedido.
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_detalle
  ADD COLUMN tipo_precio VARCHAR(20) NOT NULL DEFAULT 'normal';

ALTER TABLE pedidos_detalle
  ADD CONSTRAINT chk_pedidos_detalle_tipo_precio
  CHECK (tipo_precio IN ('normal', 'mayorista', 'frio'));

-- ----------------------------------------------------------------------------
-- 4. Helper interno: resuelve el precio real de una línea según el tipo
--    pedido, validando permiso por rol y que el producto tenga ese precio
--    configurado. Se marca SECURITY DEFINER y sin GRANT a authenticated:
--    solo lo llaman crear/editar_pedido_transaccional desde dentro (ya
--    corren como el dueño de las funciones), no está pensado para
--    invocarse directo vía RPC pública.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolver_precio_pedido(
  p_producto_id UUID,
  p_nombre TEXT,
  p_precio_venta NUMERIC,
  p_precio_frio NUMERIC,
  p_cantidad INTEGER,
  p_tipo_precio TEXT
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
    IF v_rol NOT IN ('soporte', 'gerencia') THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar precio al por mayor.';
    END IF;

    SELECT precio INTO v_precio
      FROM productos_precios_mayoristas
      WHERE producto_id = p_producto_id AND estado = true AND eliminado IS NULL
        AND cantidad_minima <= p_cantidad
      ORDER BY cantidad_minima DESC
      LIMIT 1;

    IF v_precio IS NULL THEN
      -- Ninguna franja califica por cantidad; si de todas formas se forzó
      -- mayorista, se usa la franja más económica configurada.
      SELECT precio INTO v_precio
        FROM productos_precios_mayoristas
        WHERE producto_id = p_producto_id AND estado = true AND eliminado IS NULL
        ORDER BY cantidad_minima ASC
        LIMIT 1;
    END IF;

    IF v_precio IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precios al por mayor configurados.', p_nombre;
    END IF;

    RETURN v_precio;
  END IF;

  IF p_tipo_precio = 'frio' THEN
    IF v_rol NOT IN ('soporte', 'gerencia', 'despachador') THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar precio frío.';
    END IF;
    IF p_precio_frio IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio frío configurado.', p_nombre;
    END IF;
    RETURN p_precio_frio;
  END IF;

  RAISE EXCEPTION 'Tipo de precio inválido: %', p_tipo_precio;
END;
$$;

REVOKE ALL ON FUNCTION resolver_precio_pedido(UUID, TEXT, NUMERIC, NUMERIC, INTEGER, TEXT) FROM PUBLIC, authenticated;

-- ----------------------------------------------------------------------------
-- 5. crear_pedido_transaccional: cada línea puede traer "tipo_precio"
--    (normal/mayorista/frio, opcional -> normal). El precio se recalcula
--    siempre en el servidor vía resolver_precio_pedido.
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
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para crear pedidos.';
  END IF;

  IF obtener_rol_actual() IN ('vendedor', 'despachador') THEN
    p_vendedor_id := auth.uid();
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

    SELECT id, nombre, disponible, precio_venta, iva, inc, precio_frio
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
      v_producto.precio_frio, v_cantidad, v_tipo_precio
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

  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, 'pendiente')
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

-- ----------------------------------------------------------------------------
-- 6. editar_pedido_transaccional: mismo soporte de tipo_precio por línea.
--    De paso se agrega despachador a los roles permitidos (ya podía crear
--    pedidos vía crear_pedido_transaccional, pero no editarlos — se le
--    olvidó incluir en esta función cuando se agregó despachador a la
--    otra, quedaba inconsistente).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_pedido_transaccional(
  p_pedido_id UUID,
  p_notas TEXT,
  p_detalles JSONB
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
  v_cantidad INTEGER;
  v_tipo_precio TEXT;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_detalle_previo RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para editar pedidos.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  SELECT id, estado INTO v_pedido
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
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, disponible, precio_venta, iva, inc, precio_frio
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
      v_producto.precio_frio, v_cantidad, v_tipo_precio
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

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio
  )
  SELECT
    p_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio'
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  UPDATE pedidos_cabecera
    SET total = v_total,
        notas = p_notas,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
