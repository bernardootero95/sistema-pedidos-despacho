-- ============================================================================
-- Entregar un pedido sin pasarlo por un despacho
-- ============================================================================
-- Hasta ahora un pedido solo llegaba a 'entregado' desde una ruta
-- (actualizar_estado_entrega_pedido_transaccional /
-- actualizar_estado_despacho_transaccional) o naciendo entregado (venta
-- directa de cajera). Para pedidos que el cliente recoge o que se llevan sin
-- armar ruta, soporte/gerencia/despachador pueden entregarlos directamente.
--
-- Mismas reglas que una entrega en ruta:
--   * Cobra el saldo con cobrar_saldo_pedido (exacto; en Efectivo si la
--     empresa no usa métodos de pago).
--   * fecha_entrega = NOW(): cuenta como venta del día en informes/dashboard.
--   * El stock ya se descontó al crear el pedido; no se toca.
--   * Al pasar a 'entregado', trg_encolar_operacion_ingefact emite la factura
--     si la facturación automática está encendida.
--
-- Solo pedidos 'pendiente': uno 'despachado' ya está en una ruta y se
-- entrega desde ella (si no, la ruta quedaría con una entrega pendiente de
-- un pedido ya entregado).
-- ============================================================================

CREATE FUNCTION entregar_pedido_sin_despacho(
  p_pedido_id UUID,
  p_pagos JSONB DEFAULT NULL -- cobro del saldo: [{ "metodo_pago_id": "...", "monto": 1000 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  -- COALESCE: obtener_rol_actual() es NULL para un usuario desactivado o
  -- sin perfil, y `NULL NOT IN (...)` no es verdadero -- sin él lo dejaría
  -- pasar.
  IF COALESCE(obtener_rol_actual(), '') NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para entregar pedidos sin despacho.';
  END IF;

  SELECT estado INTO v_estado
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_estado = 'despachado' THEN
    RAISE EXCEPTION 'El pedido ya está en un despacho; márcalo entregado desde la ruta.';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden entregar pedidos pendientes (estado actual: %).', v_estado;
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);

  PERFORM cobrar_saldo_pedido(p_pedido_id, p_pagos);

  UPDATE pedidos_cabecera
    SET estado = 'entregado',
        fecha_entrega = NOW(),
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object('id', p_pedido_id, 'estado', 'entregado');
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION entregar_pedido_sin_despacho(UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION entregar_pedido_sin_despacho(UUID, JSONB) FROM PUBLIC, anon;
