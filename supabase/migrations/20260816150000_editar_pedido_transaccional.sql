-- ============================================================================
-- Función transaccional para editar un pedido pendiente
-- ============================================================================
-- pedidos_detalle no tiene ninguna política RLS de INSERT/UPDATE/DELETE
-- (ver 20260811221215_rls_permisos_por_rol.sql): la única vía para tocar
-- líneas de un pedido es una función SECURITY DEFINER, igual que la
-- creación. No alcanza con updates simples desde el cliente.
--
-- Estrategia: en vez de diffear línea por línea (agregar esta, quitar
-- aquella, ajustar cantidad de la otra), se devuelve el stock completo de
-- las líneas actuales y se vuelve a correr el mismo algoritmo de
-- crear_pedido_transaccional sobre la lista nueva completa. Es más simple
-- de razonar correctamente que un diff, y reutiliza el mismo cálculo de
-- precio/IVA/INC desde productos (fuente de verdad) para toda línea que
-- quede en el pedido, no solo las que cambiaron.
--
-- No toca numero_pedido, cliente_id ni vendedor_id: editar un pedido es
-- ajustar productos/cantidades/notas, no reasignarlo a otro cliente.
-- ============================================================================

CREATE OR REPLACE FUNCTION editar_pedido_transaccional(
  p_pedido_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 2 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_producto RECORD;
  v_cantidad INTEGER;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_detalle_previo RECORD;
BEGIN
  -- SECURITY DEFINER bypasea RLS: el chequeo de rol tiene que vivir acá
  -- adentro, no se puede confiar en que el frontend no lo llame desde un
  -- rol operativo que no debería editar pedidos (despachador, repartidor).
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor') THEN
    RAISE EXCEPTION 'No tienes permiso para editar pedidos.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 1. Bloquear la cabecera y validar que siga editable. El lock FOR
  --    UPDATE evita que un despachador arme una ruta con este pedido
  --    mientras se está editando (crear_despacho_transaccional también
  --    bloquea pedidos_cabecera al asignar).
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

  -- 2. Devolver al stock las cantidades de las líneas actuales antes de
  --    reemplazarlas, bloqueando cada producto en orden por id (mismo
  --    criterio anti-deadlock que crear_pedido_transaccional).
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

  -- 3. Igual que crear_pedido_transaccional: bloquear y validar cada
  --    producto de la lista nueva, calculando precio/IVA/INC desde
  --    productos (nunca desde lo que mande el cliente).
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

    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea
  )
  SELECT
    p_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  -- 4. Actualizar cabecera (total recalculado + notas)
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
    -- Cualquier error revierte automáticamente todo (stock, detalle, cabecera)
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_pedido_transaccional(UUID, TEXT, JSONB) TO authenticated;
