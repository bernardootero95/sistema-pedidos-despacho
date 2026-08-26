-- ============================================================================
-- Anular un pedido debe devolver el stock que se descontó al crearlo
-- ============================================================================
-- orderService.anularPedido hacía hasta ahora un UPDATE directo de
-- pedidos_cabecera (estado/notas/actualizado), cubierto solo por la política
-- RLS "pedidos_cabecera_update_comercial". Nunca tocaba `productos.disponible`,
-- así que el stock descontado en crear_pedido_transaccional quedaba
-- "atrapado": un pedido anulado seguía restando existencias para siempre,
-- hasta que la próxima importación de Excel lo corregía de rebote (ver
-- migración 20260826100000).
--
-- Esta función lo mueve a una RPC transaccional (patrón ya usado por
-- crear_pedido_transaccional / editar_pedido_transaccional) que, al anular,
-- devuelve la cantidad de cada línea a `productos.disponible` — pero solo si
-- el pedido seguía 'pendiente' o 'despachado' (aún no entregado/devuelto):
-- ese es el mismo criterio de "stock comprometido" usado en la importación
-- de Excel, para que ambas piezas cuenten exactamente lo mismo como
-- reservado. Si el pedido ya estaba 'entregado' o 'devuelto', anularlo no
-- devuelve stock (la mercancía ya salió o el sistema contable ya la cuenta
-- de vuelta).
--
-- La verificación de permisos replica la política RLS que reemplaza (mismo
-- criterio: gerencia/soporte sin restricción, vendedor solo sobre pedidos
-- propios en estado 'pendiente'), ya que SECURITY DEFINER no pasa por RLS.
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
    obtener_rol_actual() IN ('gerencia', 'soporte')
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

GRANT EXECUTE ON FUNCTION anular_pedido_transaccional(UUID, TEXT) TO authenticated;
