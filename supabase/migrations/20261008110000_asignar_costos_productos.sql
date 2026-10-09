-- ============================================================================
-- Asignar el costo a varios productos a la vez (desde los informes de
-- inventario)
-- ============================================================================
-- Los informes de inventario valoran a costo con `productos_costos`, y los
-- productos que nunca se compraron por el módulo de compras no tienen fila
-- ahí (valen $0 a costo). `asignar_costo_producto` fija el costo de uno solo;
-- esta variante recibe un lote para completar muchos de una vez, en una sola
-- transacción: o se guardan todos o ninguno.
--
-- Mismo permiso y misma regla que `asignar_costo_producto` (soporte,
-- gerencia y despachador; costo >= 0; producto existente). Sigue siendo el
-- "último costo": la próxima compra registrada lo sobrescribe.
-- ============================================================================
CREATE OR REPLACE FUNCTION asignar_costos_productos(
  p_costos JSONB -- [{ "producto_id": "...", "costo": 1500 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_producto_id UUID;
  v_costo NUMERIC;
  v_guardados INTEGER := 0;
BEGIN
  IF COALESCE(obtener_rol_actual(), '') NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para asignar el costo de los productos.';
  END IF;

  IF p_costos IS NULL OR jsonb_typeof(p_costos) <> 'array' OR jsonb_array_length(p_costos) = 0 THEN
    RAISE EXCEPTION 'No se recibió ningún costo.';
  END IF;

  -- Orden estable por producto: dos lotes simultáneos toman los bloqueos en
  -- el mismo orden y no se bloquean entre sí.
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_costos)
    ORDER BY (value->>'producto_id')
  LOOP
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_costo := (v_item->>'costo')::NUMERIC;

    IF v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'El costo debe ser un número mayor o igual a 0 (producto %).', v_item->>'producto_id';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM productos WHERE id = v_producto_id AND eliminado IS NULL
    ) THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    INSERT INTO productos_costos (producto_id, ultimo_costo)
    VALUES (v_producto_id, v_costo)
    ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;

    v_guardados := v_guardados + 1;
  END LOOP;

  RETURN jsonb_build_object('guardados', v_guardados);
END;
$$;

REVOKE ALL ON FUNCTION asignar_costos_productos(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION asignar_costos_productos(JSONB) TO authenticated;
