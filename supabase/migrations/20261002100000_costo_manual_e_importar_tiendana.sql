-- ============================================================================
-- Costo manual del producto + importación del Excel de Tiendana
-- ============================================================================
-- 1. `asignar_costo_producto`: hasta ahora `productos_costos` solo se
--    escribía desde las RPC de compras, así que un producto creado a mano
--    quedaba "sin costo" hasta su primera compra (y el informe de utilidad
--    lo trataba como costo desconocido). Ahora el formulario de producto
--    puede fijarlo. Mismos roles que leen la tabla; la próxima compra lo
--    sobrescribe igual que antes (sigue siendo "último costo").
--
-- 2. `importar_productos_excel` acepta campos opcionales para el Excel de
--    Tiendana (que no trae el código interno del ERP):
--      * `codigo` ausente → se busca el producto por nombre (sin distinguir
--        mayúsculas) y, si no existe, se crea con el siguiente consecutivo
--        numérico de 5 dígitos (00001, 00002...). Re-subir el mismo archivo
--        actualiza en vez de duplicar.
--      * `costo` → se guarda en `productos_costos`.
--      * `codigo_barra`, `categoria`, `descripcion`, `iva`, `inc` → solo al
--        crear (la ficha ya existente no se pisa, igual que antes con el
--        nombre). `iva` ausente conserva el default histórico (gravado 19%);
--        `iva` = 0 crea el producto como excluido.
--    El formato del ERP (siempre con `codigo`, sin el resto) se comporta
--    exactamente igual que antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. asignar_costo_producto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asignar_costo_producto(
  p_producto_id UUID,
  p_costo NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para asignar el costo del producto.';
  END IF;

  IF p_costo IS NULL OR p_costo < 0 THEN
    RAISE EXCEPTION 'El costo debe ser un número mayor o igual a 0.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM productos WHERE id = p_producto_id AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'El producto no existe o fue eliminado.';
  END IF;

  INSERT INTO productos_costos (producto_id, ultimo_costo)
  VALUES (p_producto_id, p_costo)
  ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
END;
$$;

REVOKE ALL ON FUNCTION asignar_costo_producto(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION asignar_costo_producto(UUID, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. importar_productos_excel
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
  v_costo NUMERIC;
  v_iva NUMERIC;
  v_inc NUMERIC;
  v_reservado NUMERIC(12,2);
  v_producto_id UUID;
  v_siguiente BIGINT;
  v_largo_codigo INTEGER;
  v_creados INTEGER := 0;
  v_actualizados INTEGER := 0;
BEGIN
  IF obtener_rol_actual() <> 'soporte' THEN
    RAISE EXCEPTION 'No tienes permiso para importar productos.';
  END IF;

  IF p_productos IS NULL OR jsonb_array_length(p_productos) = 0 THEN
    RAISE EXCEPTION 'No se recibió ningún producto para importar.';
  END IF;

  -- Serializa importaciones concurrentes: el consecutivo se calcula una vez
  -- y se incrementa en memoria.
  PERFORM pg_advisory_xact_lock(hashtext('importar_productos_excel'));

  SELECT COALESCE(MAX(codigo::BIGINT), 0) + 1,
         GREATEST(COALESCE(MAX(length(codigo)), 0), 5)
    INTO v_siguiente, v_largo_codigo
    FROM productos
    WHERE codigo ~ '^[0-9]+$';

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_productos) WITH ORDINALITY ORDER BY ordinality
  LOOP
    v_codigo := NULLIF(trim(v_item->>'codigo'), '');
    v_nombre := NULLIF(trim(v_item->>'nombre'), '');
    v_precio := (v_item->>'precio_venta')::NUMERIC;
    v_disponible := (v_item->>'disponible')::NUMERIC;
    v_costo := (v_item->>'costo')::NUMERIC;
    v_iva := (v_item->>'iva')::NUMERIC;
    v_inc := (v_item->>'inc')::NUMERIC;

    IF v_codigo IS NULL AND v_nombre IS NULL THEN
      RAISE EXCEPTION 'Hay un producto sin código ni nombre en el archivo.';
    END IF;
    IF v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'Precio inválido para el producto "%".', COALESCE(v_codigo, v_nombre);
    END IF;
    IF v_disponible IS NULL OR v_disponible < 0 THEN
      RAISE EXCEPTION 'Existencia inválida para el producto "%".', COALESCE(v_codigo, v_nombre);
    END IF;
    IF v_costo IS NOT NULL AND v_costo < 0 THEN
      RAISE EXCEPTION 'Costo inválido para el producto "%".', COALESCE(v_codigo, v_nombre);
    END IF;

    IF v_codigo IS NOT NULL THEN
      SELECT id INTO v_producto_id FROM productos WHERE codigo = v_codigo;
    ELSE
      SELECT id INTO v_producto_id
        FROM productos
        WHERE lower(trim(nombre)) = lower(v_nombre)
          AND eliminado IS NULL
        ORDER BY creado
        LIMIT 1;
    END IF;

    IF v_producto_id IS NOT NULL THEN
      -- Ver 20260826100000: disponible = valor del archivo - reservado.
      SELECT COALESCE(SUM(pd.cantidad), 0)
        INTO v_reservado
        FROM pedidos_detalle pd
        JOIN pedidos_cabecera pc ON pc.id = pd.pedido_id
        WHERE pd.producto_id = v_producto_id
          AND pc.estado IN ('pendiente', 'despachado');

      UPDATE productos
        SET disponible = v_disponible - v_reservado,
            precio_venta = v_precio,
            actualizado = NOW()
        WHERE id = v_producto_id;

      v_actualizados := v_actualizados + 1;
    ELSE
      IF v_nombre IS NULL THEN
        RAISE EXCEPTION 'El producto nuevo "%" no tiene nombre.', v_codigo;
      END IF;

      IF v_codigo IS NULL THEN
        v_codigo := lpad(v_siguiente::TEXT, v_largo_codigo, '0');
        v_siguiente := v_siguiente + 1;
      END IF;

      INSERT INTO productos (
        codigo, nombre, precio_venta, disponible, clasificacion, iva, inc,
        codigo_barra, categoria, descripcion
      )
      VALUES (
        v_codigo,
        v_nombre,
        v_precio,
        v_disponible,
        CASE WHEN COALESCE(v_iva, 19) > 0 THEN 'gravado' ELSE 'excluido' END,
        COALESCE(v_iva, 19),
        COALESCE(v_inc, 0),
        NULLIF(trim(v_item->>'codigo_barra'), ''),
        NULLIF(trim(v_item->>'categoria'), ''),
        NULLIF(trim(v_item->>'descripcion'), '')
      )
      RETURNING id INTO v_producto_id;

      v_creados := v_creados + 1;
    END IF;

    IF v_costo IS NOT NULL THEN
      INSERT INTO productos_costos (producto_id, ultimo_costo)
      VALUES (v_producto_id, v_costo)
      ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
    END IF;

    v_producto_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados);
END;
$$;
