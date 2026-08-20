-- ============================================================================
-- Despachador: permite crear pedidos y clientes desde Nuevo Pedido
-- ============================================================================
-- El despachador ya veía la página de Nuevo Pedido (ROLES_MODULO.PEDIDOS lo
-- incluye), pero la fuente de verdad en el servidor lo rechazaba en dos
-- puntos:
--   1. crear_pedido_transaccional solo aceptaba soporte/gerencia/vendedor.
--   2. clientes_insert_comercial (usada por el quick-add de cliente en esa
--      misma página) tampoco lo contemplaba, así que el formulario se veía
--      bien pero el INSERT fallaba por RLS.
--
-- Igual que con vendedor, se fuerza p_vendedor_id = auth.uid() cuando quien
-- llama es despachador: no hay razón para confiar en lo que mande el
-- cliente, y evita que un despachador cree un pedido a nombre de otro.
-- ============================================================================

CREATE OR REPLACE FUNCTION crear_pedido_transaccional(
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 2 }, ...]
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

  -- Un vendedor o despachador siempre crea a su propio nombre, sin importar
  -- lo que mande el cliente: es lo único que mantiene coherente el filtro
  -- de "mis pedidos" en pedidos_cabecera_select_operativo (para vendedor) y
  -- evita que se le "adjudique" el pedido a otra persona.
  IF obtener_rol_actual() IN ('vendedor', 'despachador') THEN
    p_vendedor_id := auth.uid();
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 1. Bloquear y validar cada producto (orden por id evita deadlocks entre
  --    transacciones concurrentes que compran los mismos productos).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
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

    v_precio := v_producto.precio_venta;
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea
    );

    -- Descontar stock inmediatamente (fila ya bloqueada con FOR UPDATE)
    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  -- 2. Generar consecutivo de forma segura dentro de la transacción
  SELECT COALESCE(MAX(numero_pedido::INTEGER), 0) + 1
    INTO v_numero_pedido
    FROM pedidos_cabecera
    WHERE numero_pedido ~ '^[0-9]+$';

  IF v_numero_pedido IS NULL THEN
    v_numero_pedido := '1';
  END IF;

  -- 3. Insertar cabecera
  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, 'pendiente')
  RETURNING id INTO v_pedido_id;

  -- 4. Insertar detalles
  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea
  )
  SELECT
    v_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Cualquier error revierte automáticamente toda la función (stock, cabecera, detalle)
    RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- Defensa en profundidad: aunque la RPC (SECURITY DEFINER) no depende de
-- esta política para su propio INSERT, se mantiene alineada con los roles
-- realmente autorizados por si algo llega a insertar directo a la tabla.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pedidos_cabecera_insert_comercial" ON pedidos_cabecera;

CREATE POLICY "pedidos_cabecera_insert_comercial" ON pedidos_cabecera
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador'));

-- ----------------------------------------------------------------------------
-- Quick-add de cliente desde Nuevo Pedido: el despachador ya podía
-- seleccionar/ver clientes (clientes_select_operativo), pero no crearlos.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "clientes_insert_comercial" ON clientes;

CREATE POLICY "clientes_insert_comercial" ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador'));
