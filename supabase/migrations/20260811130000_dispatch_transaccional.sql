-- ============================================================================
-- Función transaccional para creación de Despachos con control de concurrencia
-- ============================================================================
-- Evita que dos despachadores asignen el mismo pedido "pendiente" a dos rutas
-- distintas simultáneamente (bloqueo FOR UPDATE sobre pedidos_cabecera).
-- Genera el codigo_despacho de forma segura dentro de la misma transacción.
--
-- Verificado contra schema_dump.sql real:
--   - despachos.notas ya existe (no se requiere ALTER TABLE)
--   - despachos.fecha_despacho es timestamptz
--   - despachos_pedidos tiene UNIQUE(despacho_id, pedido_id)
--   - pedidos_cabecera.estado no tiene CHECK constraint (texto libre)
-- ============================================================================

CREATE OR REPLACE FUNCTION crear_despacho_transaccional(
  p_vehiculo_id UUID,
  p_repartidor_id UUID,
  p_fecha_despacho TIMESTAMPTZ,
  p_notas TEXT,
  p_pedidos_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_despacho_id UUID;
  v_codigo_despacho TEXT;
  v_siguiente_numero INTEGER;
BEGIN
  IF p_vehiculo_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un vehículo.';
  END IF;

  IF p_repartidor_id IS NULL THEN
    RAISE EXCEPTION 'Debe asignar un conductor/repartidor.';
  END IF;

  IF p_pedidos_ids IS NULL OR array_length(p_pedidos_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe asignar al menos un pedido a la ruta.';
  END IF;

  -- 1. Bloquear y validar cada pedido (evita doble asignación concurrente
  --    por dos despachadores trabajando al mismo tiempo)
  FOR v_pedido IN
    SELECT id, numero_pedido, estado
      FROM pedidos_cabecera
      WHERE id = ANY(p_pedidos_ids)
        AND eliminado IS NULL
      ORDER BY id
      FOR UPDATE
  LOOP
    IF v_pedido.estado <> 'pendiente' THEN
      RAISE EXCEPTION 'El pedido % ya no está pendiente (estado actual: %). Puede que otro despachador ya lo haya asignado.',
        v_pedido.numero_pedido, v_pedido.estado;
    END IF;
  END LOOP;

  -- Verificar que todos los IDs enviados existan (evita ids "fantasma")
  IF (SELECT COUNT(*) FROM pedidos_cabecera WHERE id = ANY(p_pedidos_ids) AND eliminado IS NULL)
     <> array_length(p_pedidos_ids, 1) THEN
    RAISE EXCEPTION 'Uno o más pedidos seleccionados ya no existen o fueron eliminados.';
  END IF;

  -- 2. Generar consecutivo del despacho (DSP-0001, DSP-0002, ...)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_despacho, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO v_siguiente_numero
    FROM despachos;

  v_codigo_despacho := 'DSP-' || LPAD(v_siguiente_numero::TEXT, 4, '0');

  -- 3. Insertar cabecera del despacho
  INSERT INTO despachos (
    codigo_despacho, vehiculo_id, repartidor_id, fecha_despacho, notas, estado
  ) VALUES (
    v_codigo_despacho, p_vehiculo_id, p_repartidor_id, p_fecha_despacho, p_notas, 'creado'
  )
  RETURNING id INTO v_despacho_id;

  -- 4. Insertar el detalle (pedidos asignados a la ruta)
  INSERT INTO despachos_pedidos (despacho_id, pedido_id, estado_entrega)
  SELECT v_despacho_id, unnest(p_pedidos_ids), 'pendiente';

  -- 5. Marcar los pedidos como despachados
  UPDATE pedidos_cabecera
    SET estado = 'despachado', actualizado = NOW()
    WHERE id = ANY(p_pedidos_ids);

  RETURN jsonb_build_object(
    'id', v_despacho_id,
    'codigo_despacho', v_codigo_despacho
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_despacho_transaccional(UUID, UUID, TIMESTAMPTZ, TEXT, UUID[]) TO authenticated;