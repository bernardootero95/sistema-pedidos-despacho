-- ============================================================================
-- La importación de Excel debe respetar el stock ya comprometido por
-- pedidos pendientes de entrega
-- ============================================================================
-- El Excel viene del sistema contable, que solo descuenta existencias
-- cuando un pedido se factura, y la factura se genera después de la
-- entrega (ver memoria_del_proyecto.md). Mientras un pedido está
-- 'pendiente' o 'despachado' (creado pero aún no entregado), ya se le
-- restó su cantidad a `productos.disponible` en el momento de crearse
-- (crear_pedido_transaccional), pero el sistema contable no lo sabe: para
-- él esa mercancía todavía existe.
--
-- Antes de este cambio, `importar_productos_excel` sobrescribía
-- `disponible` con el valor crudo del Excel, "revivos" el stock que en
-- realidad seguía comprometido por esos pedidos y permitiendo venderlo dos
-- veces. Ahora, cada fila del Excel se sobrescribe con
-- `disponible_excel - reservado`, donde `reservado` es la suma de
-- cantidades en pedidos 'pendiente'/'despachado' para ese producto — el
-- mismo criterio de "aún no entregado" usado en anular_pedido_transaccional
-- para decidir si hay que devolver stock al anular.
-- ============================================================================
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
  v_disponible INTEGER;
  v_reservado INTEGER;
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
    v_disponible := (v_item->>'disponible')::INTEGER;

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

      -- Un producto nuevo no puede tener pedidos previos que lo referencien,
      -- así que no hay nada reservado que restar.
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
    -- Cualquier error revierte toda la importación: o queda completa o no
    -- queda nada a medias.
    RAISE;
END;
$$;
