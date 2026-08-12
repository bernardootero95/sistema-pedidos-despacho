-- ============================================================================
-- Cierra el ciclo de vida del pedido dentro de un despacho
-- ============================================================================
-- Hasta ahora pedidos_cabecera.estado se quedaba en 'despachado' para
-- siempre: no había forma de reflejar que un pedido efectivamente se
-- entregó o que fue devuelto. Se agregan dos funciones RPC transaccionales
-- (mismo patrón que crear_pedido_transaccional / crear_despacho_transaccional:
-- SECURITY DEFINER, bloqueo de filas, validación de rol):
--
-- 1. actualizar_estado_despacho_transaccional: cambia el estado general del
--    despacho validando la transición EN EL SERVIDOR (no solo en el
--    frontend, que puede quedar desactualizado o ser evadido). Al
--    completar el despacho, marca automáticamente 'entregado' cualquier
--    pedido de la ruta que seguía 'pendiente' de entrega. Al anular,
--    libera de vuelta a 'pendiente' los pedidos que aún no se habían
--    entregado ni rechazado, para que puedan reasignarse a otro despacho
--    (si no se hiciera esto, quedarían huérfanos en 'despachado' para
--    siempre, invisibles para getPedidosPendientes()).
--
-- 2. actualizar_estado_entrega_pedido_transaccional: permite corregir el
--    estado de un pedido puntual dentro de la ruta (entregado/rechazado/
--    pendiente) para casos como devoluciones parciales, sincronizando
--    pedidos_cabecera.estado en la misma transacción.
--
-- Ambas restringen la ejecución a los roles operativos de logística
-- (despachador, repartidor, gerencia, soporte) vía obtener_rol_actual(),
-- seguridad que no tenían crear_pedido_transaccional ni
-- crear_despacho_transaccional (queda anotado como pendiente aparte, no
-- se toca en esta migración para no ampliar el alcance de este cambio).
-- ============================================================================

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

  -- Bloquear el despacho para evitar que dos usuarios cambien su estado
  -- al mismo tiempo (ej. uno completa mientras otro anula)
  SELECT estado INTO v_estado_actual
    FROM despachos
    WHERE id = p_despacho_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El despacho no existe o fue eliminado.';
  END IF;

  -- Mismo mapa de transiciones válidas que valida el frontend, pero aquí
  -- es la fuente de verdad: creado/en_ruta son estados abiertos,
  -- completado/anulado son finales.
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
    -- Todo pedido que seguía 'pendiente' de entrega en esta ruta se marca
    -- como entregado. Los que ya se habían marcado 'rechazado' a mano
    -- durante la ruta se respetan tal cual (no se pisan).
    UPDATE despachos_pedidos
      SET estado_entrega = 'entregado'
      WHERE despacho_id = p_despacho_id
        AND estado_entrega = 'pendiente';

    UPDATE pedidos_cabecera pc
      SET estado = 'entregado', actualizado = NOW()
      FROM despachos_pedidos dp
      WHERE dp.despacho_id = p_despacho_id
        AND dp.pedido_id = pc.id
        AND dp.estado_entrega = 'entregado'
        AND pc.eliminado IS NULL;

  ELSIF p_nuevo_estado = 'anulado' THEN
    -- Los pedidos que aún no se habían entregado ni rechazado quedan
    -- libres otra vez para asignarse a un despacho nuevo.
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


CREATE OR REPLACE FUNCTION "public"."actualizar_estado_entrega_pedido_transaccional"(
  "p_despacho_pedido_id" "uuid",
  "p_nuevo_estado_entrega" "text",
  "p_notas_entrega" "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pedido_id UUID;
  v_estado_despacho TEXT;
  v_estado_cabecera TEXT;
BEGIN
  IF obtener_rol_actual() NOT IN ('despachador', 'repartidor', 'gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar la entrega de un pedido.';
  END IF;

  IF p_nuevo_estado_entrega NOT IN ('pendiente', 'entregado', 'rechazado') THEN
    RAISE EXCEPTION 'Estado de entrega inválido: %', p_nuevo_estado_entrega;
  END IF;

  SELECT dp.pedido_id, d.estado
    INTO v_pedido_id, v_estado_despacho
    FROM despachos_pedidos dp
    JOIN despachos d ON d.id = dp.despacho_id
    WHERE dp.id = p_despacho_pedido_id
    FOR UPDATE OF dp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no está asignado a ningún despacho.';
  END IF;

  IF v_estado_despacho = 'anulado' THEN
    RAISE EXCEPTION 'No se puede modificar la entrega de un despacho anulado.';
  END IF;

  UPDATE despachos_pedidos
    SET estado_entrega = p_nuevo_estado_entrega,
        notas_entrega = COALESCE(p_notas_entrega, notas_entrega)
    WHERE id = p_despacho_pedido_id;

  v_estado_cabecera := CASE p_nuevo_estado_entrega
    WHEN 'entregado' THEN 'entregado'
    WHEN 'rechazado' THEN 'devuelto'
    ELSE 'despachado'
  END;

  UPDATE pedidos_cabecera
    SET estado = v_estado_cabecera, actualizado = NOW()
    WHERE id = v_pedido_id
      AND eliminado IS NULL;

  RETURN jsonb_build_object(
    'despacho_pedido_id', p_despacho_pedido_id,
    'pedido_id', v_pedido_id,
    'estado_entrega', p_nuevo_estado_entrega,
    'estado_pedido', v_estado_cabecera
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION "public"."actualizar_estado_entrega_pedido_transaccional"("p_despacho_pedido_id" "uuid", "p_nuevo_estado_entrega" "text", "p_notas_entrega" "text") OWNER TO "postgres";

REVOKE EXECUTE ON FUNCTION "public"."actualizar_estado_entrega_pedido_transaccional"("uuid", "text", "text") FROM anon;
GRANT EXECUTE ON FUNCTION "public"."actualizar_estado_entrega_pedido_transaccional"("uuid", "text", "text") TO "authenticated";