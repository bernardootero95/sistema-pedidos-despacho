-- ----------------------------------------------------------------------------
-- Despachador: puede ver el catálogo completo de productos (ROLES_MODULO en
-- el frontend, sin cambio de RLS: productos_select_operativo ya lo incluye)
-- y editar únicamente los precios (venta, frío, crédito) de un producto
-- existente, nunca el stock ni el resto de la ficha. Se implementa como RPC
-- SECURITY DEFINER en vez de una policy de UPDATE porque RLS no puede
-- restringir a nivel de columna: la función solo toca esas tres columnas,
-- sin importar qué reciba en los parámetros.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_precios_producto(
  p_id UUID,
  p_precio_venta NUMERIC,
  p_precio_frio NUMERIC,
  p_precio_credito NUMERIC
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
  IF p_precio_frio IS NOT NULL AND p_precio_frio < 0 THEN
    RAISE EXCEPTION 'El precio frío debe ser mayor o igual a 0.';
  END IF;
  IF p_precio_credito IS NOT NULL AND p_precio_credito < 0 THEN
    RAISE EXCEPTION 'El precio a crédito debe ser mayor o igual a 0.';
  END IF;

  UPDATE productos
  SET
    precio_venta = p_precio_venta,
    precio_frio = p_precio_frio,
    precio_credito = p_precio_credito,
    actualizado = now()
  WHERE id = p_id AND eliminado IS NULL
  RETURNING * INTO v_producto;

  IF v_producto IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  RETURN v_producto;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_precios_producto(UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
