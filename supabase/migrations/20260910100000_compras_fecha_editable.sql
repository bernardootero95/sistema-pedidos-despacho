-- ============================================================================
-- Permite ingresar la fecha real de la compra, distinta de cuándo se
-- registró en el sistema
-- ============================================================================
-- Hasta ahora `compras_cabecera.fecha_compra` siempre quedaba en NOW() al
-- crear la compra (default de columna, nunca la mandaba
-- crear_compra_transaccional en el INSERT). Eso no sirve para cargar
-- compras atrasadas (ej. una factura de hace una semana): la fecha de la
-- compra y la fecha de registro terminaban siendo siempre la misma.
--
-- Se agrega el parámetro `p_fecha_compra` a crear_compra_transaccional
-- (con DEFAULT NULL -> NOW(), por si algún caller viejo no lo manda) para
-- que el usuario pueda indicar cuándo ocurrió la compra. La fecha de
-- registro real sigue intacta en `compras_cabecera.creado`, que ya se
-- llenaba solo con el DEFAULT now() de la columna — no hacía falta
-- tocarla, solo dejar de confundirla con `fecha_compra` en el INSERT.
--
-- Como cambia el número de parámetros, hay que recrear la función (DROP +
-- CREATE): CREATE OR REPLACE no permite agregar parámetros nuevos aunque
-- tengan DEFAULT.
-- ============================================================================

DROP FUNCTION IF EXISTS crear_compra_transaccional(UUID, TEXT, JSONB);

CREATE FUNCTION crear_compra_transaccional(
  p_proveedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB, -- [{ "producto_id": "...", "cantidad": 10, "costo_unitario": 1500 }, ...]
  p_fecha_compra TIMESTAMPTZ DEFAULT NULL
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
  v_costo_unitario NUMERIC(12,2);
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_compra TEXT;
  v_compra_id UUID;
  v_fecha_compra TIMESTAMPTZ;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar compras.';
  END IF;

  IF p_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un proveedor.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La compra debe contener al menos un producto.';
  END IF;

  v_fecha_compra := COALESCE(p_fecha_compra, NOW());
  IF v_fecha_compra > NOW() THEN
    RAISE EXCEPTION 'La fecha de la compra no puede ser futura.';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_costo_unitario := (v_item->>'costo_unitario')::NUMERIC;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF v_costo_unitario IS NULL OR v_costo_unitario < 0 THEN
      RAISE EXCEPTION 'Costo unitario inválido para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    v_subtotal_linea := v_costo_unitario * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'costo_unitario', v_costo_unitario,
      'subtotal_linea', v_subtotal_linea
    );

    UPDATE productos
      SET disponible = disponible + v_cantidad,
          ultimo_costo = v_costo_unitario,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  SELECT COALESCE(MAX(numero_compra::INTEGER), 0) + 1
    INTO v_numero_compra
    FROM compras_cabecera
    WHERE numero_compra ~ '^[0-9]+$';

  IF v_numero_compra IS NULL THEN
    v_numero_compra := '1';
  END IF;

  INSERT INTO compras_cabecera (numero_compra, proveedor_id, usuario_id, notas, total, fecha_compra)
  VALUES (v_numero_compra, p_proveedor_id, auth.uid(), p_notas, v_total, v_fecha_compra)
  RETURNING id INTO v_compra_id;

  INSERT INTO compras_detalle (
    compra_id, producto_id, cantidad, costo_unitario, subtotal_linea
  )
  SELECT
    v_compra_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'costo_unitario')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_compra_id,
    'numero_compra', v_numero_compra,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB, TIMESTAMPTZ) FROM anon;
