-- ============================================================================
-- Cantidades decimales: permitir vender/facturar fracciones de unidad
-- ============================================================================
-- pedidos_detalle.cantidad y productos.disponible eran INTEGER: no se podía
-- vender media caja de un producto. Se pasan a NUMERIC(12,2) (misma
-- precisión que el resto de columnas monetarias del esquema: precio_venta,
-- total, etc.) y se ajustan las funciones que los leían/casteaban como
-- entero.
--
-- productos_precios_mayoristas.cantidad_minima se deja como INTEGER a
-- propósito: son umbrales de franja ("10 unidades o más"), no cantidades de
-- una línea de pedido — no hay caso de negocio para fraccionarlos, y
-- Postgres compara INTEGER contra NUMERIC sin problema (cast implícito).
-- ============================================================================

ALTER TABLE pedidos_detalle ALTER COLUMN cantidad TYPE NUMERIC(12,2) USING cantidad::NUMERIC(12,2);

ALTER TABLE productos ALTER COLUMN disponible TYPE NUMERIC(12,2) USING disponible::NUMERIC(12,2);
ALTER TABLE productos ALTER COLUMN disponible SET DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 1. resolver_precio_pedido: p_cantidad pasa a NUMERIC. Cambia la firma
--    (INTEGER -> NUMERIC en esa posición), así que hay que dropear la
--    versión vieja para no dejar un overload huérfano (mismo criterio que
--    20260825100000 al agregar p_precio_credito).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS resolver_precio_pedido(UUID, TEXT, NUMERIC, NUMERIC, INTEGER, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION resolver_precio_pedido(
  p_producto_id UUID,
  p_nombre TEXT,
  p_precio_venta NUMERIC,
  p_precio_frio NUMERIC,
  p_cantidad NUMERIC,
  p_tipo_precio TEXT,
  p_precio_credito NUMERIC DEFAULT NULL
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

  IF p_tipo_precio = 'credito' THEN
    IF v_rol NOT IN ('soporte', 'gerencia', 'despachador') THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar precio a crédito.';
    END IF;
    IF p_precio_credito IS NULL THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio a crédito configurado.', p_nombre;
    END IF;
    RETURN p_precio_credito;
  END IF;

  RAISE EXCEPTION 'Tipo de precio inválido: %', p_tipo_precio;
END;
$$;

REVOKE ALL ON FUNCTION resolver_precio_pedido(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC) FROM PUBLIC, authenticated;

-- ----------------------------------------------------------------------------
-- 2. crear_pedido_transaccional / editar_pedido_transaccional: v_cantidad
--    pasa a NUMERIC(12,2) y los casts ::INTEGER de cantidad a ::NUMERIC.
--    Firma sin cambios (p_detalles sigue siendo JSONB), CREATE OR REPLACE
--    normal.
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
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
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

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
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

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio
  )
  SELECT
    p_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
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

-- ----------------------------------------------------------------------------
-- 3. importar_productos_excel: v_disponible/v_reservado pasan a NUMERIC.
-- ----------------------------------------------------------------------------
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
