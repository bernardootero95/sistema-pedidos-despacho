-- ============================================================================
-- Fecha de entrega real por pedido + historial de cambios de estado
-- ============================================================================
-- Hasta ahora "venta real" (20260826130000) se calculaba con fecha_pedido
-- porque no existía una fecha de entrega separada: un pedido creado el día
-- 1 pero entregado el día 5 se contaba como venta real del día 1, lo cual
-- es incorrecto (el dinero entra el día de la entrega, no el de la orden).
--
-- Se agrega pedidos_cabecera.fecha_entrega, se completa automáticamente al
-- marcar un pedido como 'entregado' (actualizar_estado_entrega_pedido_
-- transaccional) y se puede corregir manualmente para pedidos ya
-- entregados vía actualizar_fecha_entrega_pedido (solo gerencia/soporte:
-- es una corrección administrativa, mismo criterio que el resto de
-- pedidos_cabecera_update_comercial).
--
-- Para el historial ("cuándo se actualizó su estado"), se reutiliza el
-- mecanismo de auditoría genérico que ya existe para perfiles/roles
-- (registrar_auditoria + tabla auditoria) en vez de crear una tabla nueva:
-- registra automáticamente cada UPDATE de pedidos_cabecera (estado,
-- fecha_entrega, notas, etc.) con quién y cuándo. Se agrega la política de
-- lectura que faltaba (la tabla auditoria tenía RLS habilitada sin
-- políticas, así que hoy nadie puede leerla), acotada al mismo alcance por
-- rol que ya usa pedidos_cabecera_select_operativo.
--
-- fecha_entrega se suma a la lista de columnas que protege
-- bloquear_edicion_directa_pedido (20260816180000): igual que `total`, es
-- un dato financiero (alimenta venta_real del dashboard) y no solo una
-- cuestión de qué fila puede tocar cada rol — sin esto, gerencia/soporte
-- podrían escribirla directo por PostgREST saltándose las validaciones de
-- actualizar_fecha_entrega_pedido (fecha futura, anterior al pedido).
-- ============================================================================

ALTER TABLE pedidos_cabecera ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;

-- Backfill razonable para pedidos ya entregados antes de este cambio: no
-- sabemos su fecha real de entrega, pero `actualizado` quedó en NOW() en el
-- momento de la transición a 'entregado' (es lo último que les pasa en el
-- flujo normal), así que es la mejor aproximación disponible.
UPDATE pedidos_cabecera
  SET fecha_entrega = actualizado
  WHERE estado = 'entregado' AND fecha_entrega IS NULL;

-- ----------------------------------------------------------------------------
-- 1. actualizar_estado_entrega_pedido_transaccional: completa/limpia
--    fecha_entrega según el nuevo estado_entrega
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_estado_entrega_pedido_transaccional(
  p_despacho_pedido_id UUID,
  p_nuevo_estado_entrega TEXT,
  p_notas_entrega TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Autoriza ante trg_bloquear_edicion_directa_pedido el UPDATE de
  -- fecha_entrega que hace el paso siguiente.
  PERFORM set_config('app.rpc_autorizado', 'true', true);

  UPDATE pedidos_cabecera
    SET estado = v_estado_cabecera,
        -- Solo 'entregado' tiene fecha de entrega real; si se revierte
        -- (pendiente/rechazado) se limpia, no queda una fecha "fantasma".
        fecha_entrega = CASE WHEN v_estado_cabecera = 'entregado' THEN NOW() ELSE NULL END,
        actualizado = NOW()
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

GRANT EXECUTE ON FUNCTION actualizar_estado_entrega_pedido_transaccional(UUID, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION actualizar_estado_entrega_pedido_transaccional(UUID, TEXT, TEXT) FROM anon;

-- ----------------------------------------------------------------------------
-- 2. actualizar_fecha_entrega_pedido: corrección manual para pedidos ya
--    entregados (gerencia/soporte)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_fecha_entrega_pedido(
  p_pedido_id UUID,
  p_fecha_entrega TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para corregir la fecha de entrega de un pedido.';
  END IF;

  IF p_fecha_entrega IS NULL THEN
    RAISE EXCEPTION 'La fecha de entrega es obligatoria.';
  END IF;

  SELECT id, estado, fecha_pedido
    INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado <> 'entregado' THEN
    RAISE EXCEPTION 'Solo se puede corregir la fecha de entrega de un pedido ya entregado.';
  END IF;

  IF p_fecha_entrega > NOW() THEN
    RAISE EXCEPTION 'La fecha de entrega no puede ser futura.';
  END IF;

  IF p_fecha_entrega < v_pedido.fecha_pedido THEN
    RAISE EXCEPTION 'La fecha de entrega no puede ser anterior a la fecha del pedido.';
  END IF;

  -- Autoriza ante trg_bloquear_edicion_directa_pedido el UPDATE de
  -- fecha_entrega que hace el paso siguiente.
  PERFORM set_config('app.rpc_autorizado', 'true', true);

  UPDATE pedidos_cabecera
    SET fecha_entrega = p_fecha_entrega,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object('id', p_pedido_id, 'fecha_entrega', p_fecha_entrega);
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_fecha_entrega_pedido(UUID, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION actualizar_fecha_entrega_pedido(UUID, TIMESTAMPTZ) FROM anon;

-- ----------------------------------------------------------------------------
-- 2b. bloquear_edicion_directa_pedido: proteger también fecha_entrega
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
  IF NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega THEN
    RAISE EXCEPTION 'La fecha de entrega solo se puede modificar a través de las funciones transaccionales del sistema.';
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Historial: auditar pedidos_cabecera con el trigger genérico ya usado
--    en perfiles/roles, y abrir su lectura con el mismo alcance por rol
--    que pedidos_cabecera_select_operativo.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_pedidos_cabecera ON pedidos_cabecera;
CREATE TRIGGER audit_pedidos_cabecera
  AFTER INSERT OR UPDATE ON pedidos_cabecera
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_select_pedidos" ON auditoria;
CREATE POLICY "auditoria_select_pedidos" ON auditoria
  FOR SELECT TO authenticated
  USING (
    tabla = 'pedidos_cabecera'
    AND EXISTS (
      SELECT 1 FROM pedidos_cabecera pc
      WHERE pc.id::text = auditoria.registro_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
          OR (obtener_rol_actual() = 'vendedor' AND pc.vendedor_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM despachos_pedidos dp
            JOIN despachos d ON d.id = dp.despacho_id
            WHERE dp.pedido_id = pc.id
              AND d.repartidor_id = auth.uid()
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Dashboard: "venta real" (día/mes) pasa a calcularse con la fecha de
--    entrega real, no con la fecha en que se creó el pedido. La preventa
--    sigue con fecha_pedido: es cuando se comprometió el pedido, que es lo
--    que representa mientras no se entregue.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_resumen_dashboard(p_vendedor_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'total_pedidos', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_pendientes', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'pendiente'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_despachados', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'despachado'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_entregados', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'pedidos_devueltos', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'devuelto'
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'venta_real_dia', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND fecha_entrega::date = CURRENT_DATE
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'venta_real_mes', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'entregado'
        AND date_trunc('month', fecha_entrega) = date_trunc('month', CURRENT_DATE)
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'preventa_dia', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado IN ('pendiente', 'despachado')
        AND fecha_pedido::date = CURRENT_DATE
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'preventa_mes', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado IN ('pendiente', 'despachado')
        AND date_trunc('month', fecha_pedido) = date_trunc('month', CURRENT_DATE)
        AND (v_filtro_vendedor IS NULL OR vendedor_id = v_filtro_vendedor)
    ),
    'despachos_activos', (
      SELECT COUNT(*) FROM despachos
      WHERE eliminado IS NULL AND estado = 'en_ruta'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION obtener_ventas_diarias(p_vendedor_id UUID DEFAULT NULL)
RETURNS TABLE(fecha DATE, venta_real NUMERIC, preventa NUMERIC)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_filtro_vendedor UUID;
BEGIN
  v_filtro_vendedor := CASE
    WHEN obtener_rol_actual() IN ('gerencia', 'soporte') THEN p_vendedor_id
    ELSE NULL
  END;

  RETURN QUERY
  SELECT
    dia::date AS fecha,
    (
      SELECT COALESCE(SUM(pc.total), 0) FROM pedidos_cabecera pc
      WHERE pc.eliminado IS NULL AND pc.estado = 'entregado'
        AND pc.fecha_entrega::date = dia::date
        AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    ) AS venta_real,
    (
      SELECT COALESCE(SUM(pc.total), 0) FROM pedidos_cabecera pc
      WHERE pc.eliminado IS NULL AND pc.estado IN ('pendiente', 'despachado')
        AND pc.fecha_pedido::date = dia::date
        AND (v_filtro_vendedor IS NULL OR pc.vendedor_id = v_filtro_vendedor)
    ) AS preventa
  FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS dia
  ORDER BY dia;
END;
$$;
