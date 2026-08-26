-- ============================================================================
-- El despachador también puede anular pedidos
-- ============================================================================
-- anular_pedido_transaccional (20260826110000) solo dejaba anular a
-- gerencia/soporte (sin restricción) o al vendedor dueño de un pedido
-- 'pendiente'. El despachador ya tiene visibilidad total de pedidos (RLS
-- pedidos_cabecera_select_operativo) y gestiona la logística de entrega,
-- así que se le da el mismo permiso sin restricción que gerencia/soporte
-- en vez de acotarlo a un subconjunto de estados.
-- ============================================================================
CREATE OR REPLACE FUNCTION anular_pedido_transaccional(
  p_pedido_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_detalle RECORD;
BEGIN
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular el pedido.';
  END IF;

  SELECT id, estado, vendedor_id INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado = 'anulado' THEN
    RAISE EXCEPTION 'El pedido ya está anulado.';
  END IF;

  IF NOT (
    obtener_rol_actual() IN ('gerencia', 'soporte', 'despachador')
    OR (
      obtener_rol_actual() = 'vendedor'
      AND v_pedido.estado = 'pendiente'
      AND v_pedido.vendedor_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para anular este pedido.';
  END IF;

  IF v_pedido.estado IN ('pendiente', 'despachado') THEN
    FOR v_detalle IN
      SELECT producto_id, cantidad
        FROM pedidos_detalle
        WHERE pedido_id = p_pedido_id
        ORDER BY producto_id
    LOOP
      UPDATE productos
        SET disponible = disponible + v_detalle.cantidad,
            actualizado = NOW()
        WHERE id = v_detalle.producto_id;
    END LOOP;
  END IF;

  UPDATE pedidos_cabecera
    SET estado = 'anulado',
        notas = p_motivo,
        actualizado = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object('id', p_pedido_id, 'estado', 'anulado');
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
