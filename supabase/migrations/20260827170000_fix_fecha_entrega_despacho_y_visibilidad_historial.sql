-- ============================================================================
-- Corrige fecha_entrega al completar una ruta de despacho, restringe el
-- historial de estados de pedidos a soporte/gerencia, y habilita que el
-- vendedor vea (sin poder editar) el despacho de sus propios pedidos.
-- ============================================================================
-- 1) actualizar_estado_despacho_transaccional (rama 'completado') marcaba
--    los pedidos de la ruta como 'entregado' sin fijar fecha_entrega, a
--    diferencia de actualizar_estado_entrega_pedido_transaccional (entrega
--    uno por uno), que sí la completa desde 20260827100000. El trigger de
--    auditoría no distingue qué RPC causó el UPDATE, así que el historial
--    igual registraba el cambio de estado con quién/cuándo; solo la
--    cabecera se quedaba sin fecha_entrega. Se corrige acá y se hace
--    backfill de los pedidos que ya quedaron así.
--
-- 2) El historial de estados (tabla auditoria) quedaba visible para
--    despachador, el vendedor dueño del pedido y el repartidor asignado.
--    Pasa a ser exclusivo de soporte/gerencia.
--
-- 3) despachos_pedidos/despachos no eran legibles en absoluto para
--    vendedor, así que no podía saber en qué despacho terminó su pedido.
--    Se agrega una regla acotada a sus propios pedidos (mismo criterio que
--    ya usa pedidos_cabecera_select_operativo), solo para mostrar el
--    número de orden de despacho en el detalle del pedido.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. actualizar_estado_despacho_transaccional: fija fecha_entrega al
--    completar la ruta.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."actualizar_estado_despacho_transaccional"(
  "p_despacho_id" "uuid",
  "p_nuevo_estado" "text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
DECLARE
  v_estado_actual TEXT;
  v_transiciones_validas TEXT[];
BEGIN
  IF obtener_rol_actual() NOT IN ('despachador', 'repartidor', 'gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el estado de un despacho.';
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  SELECT estado INTO v_estado_actual
    FROM despachos
    WHERE id = p_despacho_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El despacho no existe o fue eliminado.';
  END IF;

  v_transiciones_validas := CASE v_estado_actual
    WHEN 'creado' THEN ARRAY['en_ruta', 'anulado']
    WHEN 'en_ruta' THEN ARRAY['completado', 'anulado']
    ELSE ARRAY[]::TEXT[]
  END;

  IF NOT (p_nuevo_estado = ANY(v_transiciones_validas)) THEN
    RAISE EXCEPTION 'No se puede pasar el despacho de "%" a "%".', v_estado_actual, p_nuevo_estado;
  END IF;

  UPDATE despachos
    SET estado = p_nuevo_estado, actualizado_en = NOW()
    WHERE id = p_despacho_id;

  IF p_nuevo_estado = 'completado' THEN
    UPDATE despachos_pedidos
      SET estado_entrega = 'entregado'
      WHERE despacho_id = p_despacho_id
        AND estado_entrega = 'pendiente';

    UPDATE pedidos_cabecera pc
      SET estado = 'entregado',
          fecha_entrega = NOW(),
          actualizado = NOW()
      FROM despachos_pedidos dp
      WHERE dp.despacho_id = p_despacho_id
        AND dp.pedido_id = pc.id
        AND dp.estado_entrega = 'entregado'
        AND pc.eliminado IS NULL;

  ELSIF p_nuevo_estado = 'anulado' THEN
    UPDATE pedidos_cabecera pc
      SET estado = 'pendiente', actualizado = NOW()
      FROM despachos_pedidos dp
      WHERE dp.despacho_id = p_despacho_id
        AND dp.pedido_id = pc.id
        AND dp.estado_entrega = 'pendiente'
        AND pc.eliminado IS NULL;
  END IF;

  RETURN jsonb_build_object('id', p_despacho_id, 'estado', p_nuevo_estado);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION "public"."actualizar_estado_despacho_transaccional"("p_despacho_id" "uuid", "p_nuevo_estado" "text") OWNER TO "postgres";
REVOKE EXECUTE ON FUNCTION "public"."actualizar_estado_despacho_transaccional"("uuid", "text") FROM anon;
GRANT EXECUTE ON FUNCTION "public"."actualizar_estado_despacho_transaccional"("uuid", "text") TO "authenticated";

-- Backfill: pedidos entregados por esta vía antes del fix, que quedaron
-- sin fecha_entrega. Misma aproximación que el backfill original
-- (20260827100000): `actualizado` quedó en NOW() en el momento de la
-- transición a 'entregado', es la mejor referencia disponible.
UPDATE pedidos_cabecera
  SET fecha_entrega = actualizado
  WHERE estado = 'entregado' AND fecha_entrega IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Historial de estados de pedidos: solo soporte y gerencia.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "auditoria_select_pedidos" ON auditoria;
CREATE POLICY "auditoria_select_pedidos" ON auditoria
  FOR SELECT TO authenticated
  USING (
    tabla = 'pedidos_cabecera'
    AND obtener_rol_actual() IN ('soporte', 'gerencia')
  );

-- ----------------------------------------------------------------------------
-- 3. despachos / despachos_pedidos: vendedor puede ver (no editar) el
--    despacho de sus propios pedidos, solo para mostrar el número de la
--    orden de despacho en el detalle del pedido.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "despachos_pedidos_select_operativo" ON despachos_pedidos;
CREATE POLICY "despachos_pedidos_select_operativo" ON despachos_pedidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despachos d
      WHERE d.id = despachos_pedidos.despacho_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
          OR d.repartidor_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM pedidos_cabecera pc
      WHERE pc.id = despachos_pedidos.pedido_id
        AND obtener_rol_actual() = 'vendedor'
        AND pc.vendedor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "despachos_select_operativo" ON despachos;
CREATE POLICY "despachos_select_operativo" ON despachos
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR repartidor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM despachos_pedidos dp
      JOIN pedidos_cabecera pc ON pc.id = dp.pedido_id
      WHERE dp.despacho_id = despachos.id
        AND obtener_rol_actual() = 'vendedor'
        AND pc.vendedor_id = auth.uid()
    )
  );
