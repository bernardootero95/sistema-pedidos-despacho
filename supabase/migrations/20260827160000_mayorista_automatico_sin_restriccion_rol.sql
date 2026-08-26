-- ============================================================================
-- El precio al por mayor se calcula automático sin importar el rol de
-- quien factura, mientras la cantidad realmente alcance la franja
-- ============================================================================
-- resolver_precio_pedido exigía soporte/gerencia para CUALQUIER línea con
-- tipo_precio = 'mayorista', incluso cuando la cantidad pedida ya
-- calificaba por sí sola para una franja (dato 100% parametrizado en
-- productos_precios_mayoristas, sin nada discrecional que decidir). El
-- frontend (useCarritoPedido) ya activa "mayorista" automáticamente al
-- cruzar el umbral sin mirar el rol, así que un vendedor podía armar un
-- carrito con el precio correcto en pantalla y aun así fallarle
-- crear_pedido_transaccional entero al guardar con "No tienes permiso
-- para aplicar precio al por mayor."
--
-- Se separa en dos casos:
--   - La cantidad SÍ alcanza una franja configurada: cálculo automático,
--     cualquier rol autorizado a crear pedidos puede guardarlo.
--   - La cantidad NO alcanza ninguna franja pero igual se pide
--     'mayorista' (forzarlo manualmente por debajo del umbral): sigue
--     siendo una decisión discrecional, reservada a soporte/gerencia,
--     igual que antes.
-- ============================================================================
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
    SELECT precio INTO v_precio
      FROM productos_precios_mayoristas
      WHERE producto_id = p_producto_id AND estado = true AND eliminado IS NULL
        AND cantidad_minima <= p_cantidad
      ORDER BY cantidad_minima DESC
      LIMIT 1;

    IF v_precio IS NOT NULL THEN
      -- La cantidad alcanza una franja real: cálculo automático desde
      -- datos parametrizados, no requiere autorización especial.
      RETURN v_precio;
    END IF;

    -- Ninguna franja califica por cantidad: forzarlo de todas formas es
    -- un descuento que la cantidad no justifica por sí sola, así que
    -- sigue reservado a soporte/gerencia.
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
