-- ============================================================================
-- Carga masiva de productos desde el Excel del ERP (sincronización manual)
-- ============================================================================
-- La sincronización automática con el ERP todavía no está lista. Mientras
-- tanto, soporte carga manualmente el archivo de inventario (columnas
-- cod_inv, nom_inv, existencia, vtotal -> codigo, nombre, disponible,
-- precio_venta). Si el código ya existe se actualiza SOLO la cantidad
-- disponible (el nombre/precio de un producto ya dado de alta no se
-- pisa con lo que traiga el Excel); si no existe se crea como producto
-- gravado con IVA 19% (todo el catálogo del primer cliente aplica esa
-- tarifa; no hay INC).
--
-- Restringida a soporte (no gerencia, a diferencia del resto de escritura
-- de productos) porque es quien maneja el archivo del ERP.
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

    UPDATE productos
      SET disponible = v_disponible,
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
    -- Cualquier error revierte toda la importación: o queda completa o no
    -- queda nada a medias.
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION importar_productos_excel(JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION importar_productos_excel(JSONB) FROM anon;
