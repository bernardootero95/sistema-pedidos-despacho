-- ============================================================================
-- Regla de negocio: un vehículo no puede tener dos despachos activos
-- ============================================================================
-- crear_despacho_transaccional() no validaba si el vehículo elegido ya
-- estaba en una ruta sin terminar (estado 'creado' o 'en_ruta'). Esto
-- permitía asignar el mismo vehículo a dos despachos simultáneos.
--
-- Se agrega la validación al inicio de la función, bloqueando la fila del
-- vehículo con FOR UPDATE antes de revisar sus despachos activos, para
-- evitar que dos despachadores se lo asignen al mismo tiempo (mismo
-- patrón de bloqueo ya usado para pedidos_cabecera y productos).
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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

  -- 1. Bloquear el vehículo y verificar que no tenga ya un despacho activo
  --    (evita que quede "en dos rutas a la vez"; el FOR UPDATE evita que
  --    dos despachadores se lo asignen al mismo tiempo)
  PERFORM 1 FROM vehiculos WHERE id = p_vehiculo_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM despachos
    WHERE vehiculo_id = p_vehiculo_id
      AND estado IN ('creado', 'en_ruta')
      AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Este vehículo ya tiene un despacho activo. Debe completarse o anularse antes de asignarle una nueva ruta.';
  END IF;

  -- 2. Bloquear y validar cada pedido (evita doble asignación concurrente
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

  -- 3. Generar consecutivo del despacho (DSP-0001, DSP-0002, ...)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_despacho, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO v_siguiente_numero
    FROM despachos;

  v_codigo_despacho := 'DSP-' || LPAD(v_siguiente_numero::TEXT, 4, '0');

  -- 4. Insertar cabecera del despacho
  INSERT INTO despachos (
    codigo_despacho, vehiculo_id, repartidor_id, fecha_despacho, notas, estado
  ) VALUES (
    v_codigo_despacho, p_vehiculo_id, p_repartidor_id, p_fecha_despacho, p_notas, 'creado'
  )
  RETURNING id INTO v_despacho_id;

  -- 5. Insertar el detalle (pedidos asignados a la ruta)
  INSERT INTO despachos_pedidos (despacho_id, pedido_id, estado_entrega)
  SELECT v_despacho_id, unnest(p_pedidos_ids), 'pendiente';

  -- 6. Marcar los pedidos como despachados
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
$_$;

ALTER FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) OWNER TO "postgres";