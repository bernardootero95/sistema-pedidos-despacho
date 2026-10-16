-- ============================================================================
-- Editar cotizaciones que aún no se han convertido en pedido
-- ============================================================================
-- editar_cotizacion_transaccional reemplaza cliente, vigencia, notas y líneas
-- de una cotización 'vigente' (incluye la vencida: al editarla se le fija una
-- nueva fecha). Una convertida o anulada no se puede editar. Reutiliza las
-- mismas reglas de precio y cantidad que crear_cotizacion_transaccional; el
-- número y la fecha de creación no cambian.
-- ============================================================================
CREATE OR REPLACE FUNCTION editar_cotizacion_transaccional(
  p_cotizacion_id UUID,
  p_cliente_id UUID,
  p_fecha_vencimiento DATE,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id", "cantidad", "tipo_precio", "tipo_precio_id", "precio_manual" }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion RECORD;
  v_item JSONB;
  v_producto RECORD;
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
  v_precio_manual NUMERIC;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Bogota')::date;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para editar cotizaciones.';
  END IF;

  SELECT id, estado, numero_cotizacion INTO v_cotizacion
    FROM cotizaciones_cabecera
    WHERE id = p_cotizacion_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no existe o fue eliminada.';
  END IF;

  IF v_cotizacion.estado = 'convertida' THEN
    RAISE EXCEPTION 'La cotización ya fue convertida en pedido y no se puede editar.';
  END IF;

  IF v_cotizacion.estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede editar una cotización anulada.';
  END IF;

  IF p_cliente_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = p_cliente_id AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Debe seleccionar un cliente válido.';
  END IF;

  IF p_fecha_vencimiento IS NULL OR p_fecha_vencimiento < v_hoy THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a hoy.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La cotización debe contener al menos un producto.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');
    v_tipo_precio_id := CASE
      WHEN v_tipo_precio = 'personalizado' THEN NULLIF(v_item->>'tipo_precio_id', '')::UUID
      ELSE NULL
    END;
    v_precio_manual := CASE
      WHEN v_tipo_precio = 'manual' THEN NULLIF(v_item->>'precio_manual', '')::NUMERIC
      ELSE NULL
    END;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF MOD((v_cantidad * 100)::INTEGER, 25) <> 0 THEN
      RAISE EXCEPTION 'La cantidad del producto % debe ser un número entero o con fracción .25, .5 o .75.', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    IF v_tipo_precio = 'manual' THEN
      IF NOT puede_cambiar_precio_manual() THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el precio de venta.';
      END IF;

      IF v_precio_manual IS NULL OR v_precio_manual < 0 OR v_precio_manual > 9999999999 THEN
        RAISE EXCEPTION 'Precio inválido para el producto "%".', v_producto.nombre;
      END IF;

      v_precio := ROUND(v_precio_manual, 2);
    ELSE
      v_precio := resolver_precio_pedido(
        v_producto.id, v_producto.nombre, v_producto.precio_venta,
        v_cantidad, v_tipo_precio, v_tipo_precio_id
      );
    END IF;

    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea,
      'tipo_precio', v_tipo_precio,
      'tipo_precio_id', v_tipo_precio_id
    );
  END LOOP;

  UPDATE cotizaciones_cabecera
    SET cliente_id = p_cliente_id,
        fecha_vencimiento = p_fecha_vencimiento,
        notas = NULLIF(trim(p_notas), ''),
        total = v_total,
        actualizado = NOW()
    WHERE id = p_cotizacion_id;

  DELETE FROM cotizaciones_detalle WHERE cotizacion_id = p_cotizacion_id;

  INSERT INTO cotizaciones_detalle (
    cotizacion_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio, tipo_precio_id
  )
  SELECT
    p_cotizacion_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio',
    NULLIF(d->>'tipo_precio_id', '')::UUID
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', p_cotizacion_id,
    'numero_cotizacion', v_cotizacion.numero_cotizacion,
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION editar_cotizacion_transaccional(UUID, UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION editar_cotizacion_transaccional(UUID, UUID, DATE, TEXT, JSONB) TO authenticated;
