-- ============================================================================
-- Bloquea la edición directa de columnas críticas en pedidos_cabecera y
-- despachos fuera de las funciones RPC transaccionales autorizadas
-- ============================================================================
-- Hallazgo de la auditoría de seguridad (punto 8, "bloquear la manipulación
-- de campos"): las políticas RLS de pedidos_cabecera/despachos filtran
-- FILAS (por rol/estado), no COLUMNAS. Un vendedor podía, con una llamada
-- directa a PostgREST (ej. devtools) fuera de la UI, hacer
-- `pedidos_cabecera.update({ total: 1 })` sobre su propio pedido pendiente
-- y saltarse por completo editar_pedido_transaccional — mismo problema en
-- despachos.estado, que hoy solo debería cambiar vía
-- actualizar_estado_despacho_transaccional.
--
-- Mismo patrón ya usado en perfiles (trg_bloquear_autoescalada), pero con
-- un mecanismo distinto: el trigger de perfiles decide por ROL de quien
-- llama (obtener_rol_actual()), que no sirve acá — las RPC son
-- SECURITY DEFINER pero corren con el JWT del mismo usuario que podría
-- estar pegándole directo a la tabla, así que el rol es idéntico en
-- ambos casos y no alcanza para distinguir "vino de la RPC" de "vino
-- directo". En su lugar, cada RPC autorizada marca una bandera de
-- sesión (set_config con is_local=true, así que se limpia sola al
-- terminar la transacción de esa llamada y no puede filtrarse a otro
-- request que reuse la misma conexión pooleada) justo antes de tocar la
-- fila; el trigger la exige para dejar pasar el cambio en las columnas
-- protegidas.
--
-- Qué se protege y qué NO, y por qué (verificado contra el código real,
-- no solo en teoría):
--   - pedidos_cabecera: total, cliente_id, vendedor_id, numero_pedido.
--     NO se protege `estado`: orderService.anularPedido hace un update
--     directo de estado/notas/actualizado hoy (sin RPC), así que
--     bloquearlo rompería esa función existente; queda como estaba,
--     cubierto solo por RLS (rol + estado='pendiente').
--   - despachos: estado, vehiculo_id, repartidor_id, fecha_despacho,
--     codigo_despacho. Se protege `estado` a diferencia de pedidos
--     porque acá SÍ es 100% RPC-only hoy: dispatchService no tiene
--     ningún update directo de estado (el único update directo es
--     eliminarDespacho, que solo toca `eliminado`, columna que se deja
--     sin proteger a propósito para no romperlo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pedidos_cabecera
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloquear_edicion_directa_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.rpc_autorizado', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.total IS DISTINCT FROM OLD.total THEN
    RAISE EXCEPTION 'El total de un pedido solo se puede modificar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    RAISE EXCEPTION 'El cliente de un pedido no se puede reasignar directamente.';
  END IF;
  IF NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id THEN
    RAISE EXCEPTION 'El vendedor de un pedido no se puede reasignar directamente.';
  END IF;
  IF NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido THEN
    RAISE EXCEPTION 'El número de pedido no se puede modificar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_edicion_directa_pedido ON pedidos_cabecera;
CREATE TRIGGER trg_bloquear_edicion_directa_pedido
  BEFORE UPDATE ON pedidos_cabecera
  FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_directa_pedido();

-- ----------------------------------------------------------------------------
-- 2. despachos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloquear_edicion_directa_despacho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.rpc_autorizado', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'El estado de un despacho solo se puede cambiar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.vehiculo_id IS DISTINCT FROM OLD.vehiculo_id THEN
    RAISE EXCEPTION 'El vehículo de un despacho no se puede reasignar directamente.';
  END IF;
  IF NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id THEN
    RAISE EXCEPTION 'El repartidor de un despacho no se puede reasignar directamente.';
  END IF;
  IF NEW.fecha_despacho IS DISTINCT FROM OLD.fecha_despacho THEN
    RAISE EXCEPTION 'La fecha de un despacho no se puede modificar directamente.';
  END IF;
  IF NEW.codigo_despacho IS DISTINCT FROM OLD.codigo_despacho THEN
    RAISE EXCEPTION 'El código de despacho no se puede modificar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_edicion_directa_despacho ON despachos;
CREATE TRIGGER trg_bloquear_edicion_directa_despacho
  BEFORE UPDATE ON despachos
  FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_directa_despacho();

-- ----------------------------------------------------------------------------
-- 3. Marcar la bandera dentro de las dos únicas RPC que legítimamente
--    tocan columnas protegidas vía UPDATE (crear_pedido_transaccional y
--    crear_despacho_transaccional no la necesitan: insertan la cabecera,
--    no la actualizan, y actualizar_estado_entrega_pedido_transaccional
--    solo toca pedidos_cabecera.estado, que no está protegido).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_pedido_transaccional(
  p_pedido_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 2 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_producto RECORD;
  v_cantidad INTEGER;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_detalle_previo RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'vendedor') THEN
    RAISE EXCEPTION 'No tienes permiso para editar pedidos.';
  END IF;

  -- Autoriza ante trg_bloquear_edicion_directa_pedido el UPDATE de total
  -- que hace el paso 4 más abajo. is_local=true: se limpia sola al
  -- terminar esta transacción, no persiste en la conexión pooleada.
  PERFORM set_config('app.rpc_autorizado', 'true', true);

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 1. Bloquear la cabecera y validar que siga editable. El lock FOR
  --    UPDATE evita que un despachador arme una ruta con este pedido
  --    mientras se está editando (crear_despacho_transaccional también
  --    bloquea pedidos_cabecera al asignar).
  SELECT id, estado INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden editar pedidos en estado pendiente (actual: %).', v_pedido.estado;
  END IF;

  -- 2. Devolver al stock las cantidades de las líneas actuales antes de
  --    reemplazarlas, bloqueando cada producto en orden por id (mismo
  --    criterio anti-deadlock que crear_pedido_transaccional).
  FOR v_detalle_previo IN
    SELECT producto_id, cantidad FROM pedidos_detalle
    WHERE pedido_id = p_pedido_id
    ORDER BY producto_id
  LOOP
    UPDATE productos
      SET disponible = disponible + v_detalle_previo.cantidad,
          actualizado = NOW()
      WHERE id = v_detalle_previo.producto_id;
  END LOOP;

  DELETE FROM pedidos_detalle WHERE pedido_id = p_pedido_id;

  -- 3. Igual que crear_pedido_transaccional: bloquear y validar cada
  --    producto de la lista nueva, calculando precio/IVA/INC desde
  --    productos (nunca desde lo que mande el cliente).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, disponible, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    IF v_producto.disponible < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.disponible;
    END IF;

    v_precio := v_producto.precio_venta;
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea
    );

    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea
  )
  SELECT
    p_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  -- 4. Actualizar cabecera (total recalculado + notas)
  UPDATE pedidos_cabecera
    SET total = v_total,
        notas = p_notas,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Cualquier error revierte automáticamente todo (stock, detalle, cabecera)
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_pedido_transaccional(UUID, TEXT, JSONB) TO authenticated;

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

  -- Autoriza ante trg_bloquear_edicion_directa_despacho el UPDATE de
  -- estado que hace esta función más abajo.
  PERFORM set_config('app.rpc_autorizado', 'true', true);

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
