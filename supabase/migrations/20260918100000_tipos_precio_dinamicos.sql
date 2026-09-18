-- ============================================================================
-- Tipos de precio dinámicos: reemplaza "frío" y "crédito" (columnas fijas en
-- productos) por un catálogo configurable
-- ============================================================================
-- Hasta ahora cada tipo de precio especial era una columna nueva en
-- productos + un valor nuevo en el CHECK de pedidos_detalle + un bloque IF
-- nuevo en resolver_precio_pedido (con su regla de roles repetida). Ahora:
--   - tipos_precio: catálogo global (nombre + qué roles pueden aplicarlo),
--     administrado por soporte/gerencia.
--   - productos_precios: el precio de un tipo para un producto (fijo, sin
--     franjas por cantidad; el mayorista sigue aparte y no se toca).
--   - pedidos_detalle.tipo_precio pasa a 'normal' | 'mayorista' |
--     'personalizado'; cuando es 'personalizado', tipo_precio_id indica cuál.
-- Frío y crédito se migran como dos filas del catálogo con el permiso que
-- ya tenían (soporte, gerencia, despachador, cajera), sin cambiar
-- comportamiento existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catálogo de tipos de precio
-- ----------------------------------------------------------------------------
CREATE TABLE tipos_precio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL CHECK (length(btrim(nombre)) > 0),
  roles_permitidos TEXT[] NOT NULL CHECK (
    cardinality(roles_permitidos) > 0
    AND roles_permitidos <@ ARRAY['soporte', 'gerencia', 'vendedor', 'despachador', 'cajera']
  ),
  estado BOOLEAN DEFAULT true,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  eliminado TIMESTAMPTZ
);

CREATE UNIQUE INDEX tipos_precio_nombre_key
  ON tipos_precio (lower(nombre))
  WHERE eliminado IS NULL;

CREATE TRIGGER set_timestamp_tipos_precio
  BEFORE UPDATE ON tipos_precio
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE tipos_precio ENABLE ROW LEVEL SECURITY;

-- Todos los roles que arman pedidos necesitan leer el catálogo para saber
-- qué tipos pueden aplicar (el servidor valida igual en resolver_precio_pedido).
CREATE POLICY "tipos_precio_select_operativo" ON tipos_precio
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera'));

-- Crear/renombrar/desactivar tipos y decidir qué roles los usan: solo
-- soporte/gerencia (vista de configuración).
CREATE POLICY "tipos_precio_write_admin" ON tipos_precio
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

GRANT ALL ON TABLE tipos_precio TO authenticated;
REVOKE ALL ON TABLE tipos_precio FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Precio de un tipo para un producto (reemplaza precio_frio/precio_credito)
-- ----------------------------------------------------------------------------
CREATE TABLE productos_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo_precio_id UUID NOT NULL REFERENCES tipos_precio(id),
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  estado BOOLEAN DEFAULT true,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  eliminado TIMESTAMPTZ
);

CREATE UNIQUE INDEX productos_precios_producto_tipo_key
  ON productos_precios (producto_id, tipo_precio_id)
  WHERE eliminado IS NULL;

CREATE INDEX productos_precios_tipo_precio_id_idx ON productos_precios (tipo_precio_id);

CREATE TRIGGER set_timestamp_productos_precios
  BEFORE UPDATE ON productos_precios
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE productos_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_precios_select_operativo" ON productos_precios
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'cajera'));

-- Mismos roles que ya editaban precio_frio/precio_credito (ProductForm /
-- ProductPriceForm). Tabla aparte, así que basta RLS por fila: no hace
-- falta un RPC como actualizar_precios_producto (que existe porque RLS no
-- restringe columnas de una misma fila de productos).
CREATE POLICY "productos_precios_write_catalogo" ON productos_precios
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

GRANT ALL ON TABLE productos_precios TO authenticated;
REVOKE ALL ON TABLE productos_precios FROM anon;

-- ----------------------------------------------------------------------------
-- 3. Migración de datos: frío y crédito pasan a ser filas del catálogo
-- ----------------------------------------------------------------------------
INSERT INTO tipos_precio (nombre, roles_permitidos) VALUES
  ('Frío',    ARRAY['soporte', 'gerencia', 'despachador', 'cajera']),
  ('Crédito', ARRAY['soporte', 'gerencia', 'despachador', 'cajera']);

INSERT INTO productos_precios (producto_id, tipo_precio_id, precio)
SELECT p.id, t.id, p.precio_frio
FROM productos p
JOIN tipos_precio t ON t.nombre = 'Frío' AND t.eliminado IS NULL
WHERE p.precio_frio IS NOT NULL;

INSERT INTO productos_precios (producto_id, tipo_precio_id, precio)
SELECT p.id, t.id, p.precio_credito
FROM productos p
JOIN tipos_precio t ON t.nombre = 'Crédito' AND t.eliminado IS NULL
WHERE p.precio_credito IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. pedidos_detalle: tipo_precio_id + nuevo CHECK
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_detalle
  ADD COLUMN tipo_precio_id UUID REFERENCES tipos_precio(id);

CREATE INDEX pedidos_detalle_tipo_precio_id_idx ON pedidos_detalle (tipo_precio_id);

ALTER TABLE pedidos_detalle DROP CONSTRAINT chk_pedidos_detalle_tipo_precio;

UPDATE pedidos_detalle d
SET tipo_precio = 'personalizado',
    tipo_precio_id = t.id
FROM tipos_precio t
WHERE d.tipo_precio = 'frio' AND t.nombre = 'Frío' AND t.eliminado IS NULL;

UPDATE pedidos_detalle d
SET tipo_precio = 'personalizado',
    tipo_precio_id = t.id
FROM tipos_precio t
WHERE d.tipo_precio = 'credito' AND t.nombre = 'Crédito' AND t.eliminado IS NULL;

ALTER TABLE pedidos_detalle
  ADD CONSTRAINT chk_pedidos_detalle_tipo_precio
  CHECK (
    tipo_precio IN ('normal', 'mayorista', 'personalizado')
    AND ((tipo_precio = 'personalizado') = (tipo_precio_id IS NOT NULL))
  );

-- ----------------------------------------------------------------------------
-- 5. resolver_precio_pedido: cambia la firma (sin precio_frio/credito, con
--    tipo_precio_id), así que hay que borrar la anterior. La rama mayorista
--    queda idéntica; frío/crédito se colapsan en una sola rama dirigida por
--    datos (tipos_precio.roles_permitidos).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS resolver_precio_pedido(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC);

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

REVOKE ALL ON FUNCTION resolver_precio_pedido(UUID, TEXT, NUMERIC, NUMERIC, TEXT, UUID) FROM PUBLIC, authenticated;

-- ----------------------------------------------------------------------------
-- 6. crear_pedido_transaccional / editar_pedido_transaccional: cada línea
--    puede traer tipo_precio_id (solo relevante si tipo_precio =
--    'personalizado'); ya no leen precio_frio/precio_credito de productos.
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
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
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

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. actualizar_precios_producto: solo queda el precio de venta en productos
--    (los precios diferenciados viven ahora en productos_precios bajo RLS).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS actualizar_precios_producto(UUID, NUMERIC, NUMERIC, NUMERIC);

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

GRANT EXECUTE ON FUNCTION actualizar_precios_producto(UUID, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Ya migrados los datos y actualizadas todas las funciones: las columnas
--    fijas dejan de existir.
-- ----------------------------------------------------------------------------
ALTER TABLE productos DROP COLUMN precio_frio;
ALTER TABLE productos DROP COLUMN precio_credito;
