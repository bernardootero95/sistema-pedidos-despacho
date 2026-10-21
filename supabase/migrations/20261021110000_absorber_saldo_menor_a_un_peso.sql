-- ============================================================================
-- Entregar pedidos cuyo saldo es menor a un peso
-- ============================================================================
-- Los totales pueden llevar centavos (cantidades decimales por precio con
-- IVA/INC: p. ej. 5.800.000,20) pero las pantallas y los cobros trabajan en
-- pesos enteros. Un pedido abonado por "el total" ($5.800.000) queda con un
-- saldo de $0,20 que se ve como $0: el diálogo de cobro pedía pagarlo y nadie
-- puede cobrar 20 centavos, así que el pedido no se podía entregar.
--
-- Regla nueva en cobrar_saldo_pedido (por donde pasan todas las entregas):
-- si no llegan pagos y el saldo es menor a 1 peso, el residual se registra
-- como un pago de 'entrega' con el mismo método del último abono (o Efectivo).
-- Así el pedido entregado queda pagado por completo (total_pagado = total) y
-- no hace falta pedir nada al usuario. Con 1 peso o más todo sigue igual.
--
-- Mismo cuerpo que 20261013110000_entrega_a_credito.sql; solo cambia el
-- bloque marcado con "NUEVO".
-- ============================================================================

CREATE OR REPLACE FUNCTION cobrar_saldo_pedido(
  p_pedido_id UUID,
  p_pagos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC;
  v_metodos_activo BOOLEAN;
  v_abonos_activo BOOLEAN;
  v_cobrado NUMERIC := 0;
  v_credito NUMERIC := 0;
  v_pagos_reales JSONB := '[]'::JSONB;
  v_item JSONB;
  v_es_credito BOOLEAN;
  v_metodo_residual UUID;
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
BEGIN
  SELECT COALESCE(total, 0) - total_pagado INTO v_saldo
    FROM pedidos_cabecera
    WHERE id = p_pedido_id;

  -- NUEVO: residual de centavos sin pagos en la solicitud.
  IF v_saldo > 0 AND v_saldo < 1 AND NOT v_hay_pagos THEN
    SELECT metodo_pago_id INTO v_metodo_residual
      FROM pagos
      WHERE pedido_id = p_pedido_id AND tipo <> 'devolucion' AND metodo_pago_id IS NOT NULL
      ORDER BY creado DESC
      LIMIT 1;

    INSERT INTO pagos (pedido_id, compra_id, metodo_pago_id, tipo, monto)
    VALUES (
      p_pedido_id,
      NULL,
      COALESCE(
        v_metodo_residual,
        (SELECT id FROM metodos_pago WHERE es_efectivo AND eliminado IS NULL)
      ),
      'entrega',
      v_saldo
    );

    v_saldo := 0;
  END IF;

  IF v_saldo <= 0 THEN
    IF v_hay_pagos THEN
      RAISE EXCEPTION 'El pedido ya está pagado por completo; no hay saldo por cobrar.';
    END IF;
    PERFORM set_config('app.rpc_autorizado', 'true', true);
    UPDATE pedidos_cabecera SET monto_credito = 0
      WHERE id = p_pedido_id AND monto_credito <> 0;
    PERFORM set_config('app.rpc_autorizado', '', true);
    RETURN;
  END IF;

  SELECT metodos_pago_activo, abonos_pedidos_activo
    INTO v_metodos_activo, v_abonos_activo
    FROM configuracion_sistema;

  IF NOT v_hay_pagos THEN
    IF v_metodos_activo THEN
      RAISE EXCEPTION 'Debe registrar el pago del saldo pendiente (%) antes de entregar.', v_saldo;
    END IF;
    p_pagos := jsonb_build_array(jsonb_build_object('monto', v_saldo));
  END IF;

  -- Separa el crédito (no es dinero) de los pagos reales.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagos)
  LOOP
    v_es_credito := v_metodos_activo AND EXISTS (
      SELECT 1 FROM metodos_pago
      WHERE id = NULLIF(v_item->>'metodo_pago_id', '')::UUID AND es_credito
    );

    IF v_es_credito THEN
      IF round((v_item->>'monto')::NUMERIC, 2) <= 0 THEN
        RAISE EXCEPTION 'El monto a crédito debe ser mayor a 0.';
      END IF;
      v_credito := v_credito + round((v_item->>'monto')::NUMERIC, 2);
    ELSE
      v_pagos_reales := v_pagos_reales || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  IF v_credito > 0 THEN
    IF NOT usuario_puede_dar_credito() THEN
      RAISE EXCEPTION 'No tienes permiso para entregar pedidos a crédito.';
    END IF;
    IF NOT v_abonos_activo THEN
      RAISE EXCEPTION 'Los abonos a pedidos no están habilitados; no se puede dejar saldo a crédito.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM metodos_pago WHERE es_credito AND estado = true AND eliminado IS NULL) THEN
      RAISE EXCEPTION 'El crédito está desactivado.';
    END IF;
  END IF;

  IF jsonb_array_length(v_pagos_reales) > 0 THEN
    v_cobrado := registrar_pagos(p_pedido_id, NULL, 'entrega', v_pagos_reales);
  END IF;

  IF v_cobrado + v_credito <> v_saldo THEN
    RAISE EXCEPTION 'El pago debe cubrir exactamente el saldo pendiente (%). Se recibió %.', v_saldo, v_cobrado + v_credito;
  END IF;

  PERFORM set_config('app.rpc_autorizado', 'true', true);
  UPDATE pedidos_cabecera SET monto_credito = v_credito WHERE id = p_pedido_id;
  PERFORM set_config('app.rpc_autorizado', '', true);
END;
$$;

REVOKE ALL ON FUNCTION cobrar_saldo_pedido(UUID, JSONB) FROM PUBLIC, authenticated;
