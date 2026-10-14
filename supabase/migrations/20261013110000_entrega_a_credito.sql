-- ============================================================================
-- Entrega a crédito: entregar un pedido dejando saldo pendiente.
--
-- Hasta ahora un pedido 'entregado' siempre estaba pagado al 100%. Con crédito
-- se puede entregar con saldo, que luego se cobra con abonos.
--
--   * metodos_pago.es_credito: método especial 'Crédito'. NO es dinero: nunca
--     genera una fila en `pagos`; en el cobro al entregar representa la parte
--     del saldo que queda a deber.
--   * pedidos_cabecera.monto_credito: cuánto quedó a crédito en la entrega
--     (para la factura y la trazabilidad; el saldo vigente sigue siendo
--     total - total_pagado).
--   * configuracion_sistema.credito_roles: perfiles que pueden entregar a
--     crédito, configurados en Pagos y Facturación junto con el resto de
--     permisos por perfil (precio_manual_roles). Soporte y gerencia SIEMPRE
--     tienen todos los permisos: un CHECK exige que estén en ambas listas.
--   * Requiere métodos de pago y abonos a pedidos activos: el crédito se
--     elige como método y se cobra después con abonos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Método de pago especial 'Crédito'
-- ----------------------------------------------------------------------------
ALTER TABLE metodos_pago ADD COLUMN IF NOT EXISTS es_credito BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS metodos_pago_credito_key
  ON metodos_pago (es_credito)
  WHERE es_credito;

INSERT INTO metodos_pago (nombre, codigo_dian, es_credito)
SELECT 'Crédito', 'ZZZ', true
WHERE NOT EXISTS (SELECT 1 FROM metodos_pago WHERE es_credito);

-- El método Crédito se puede desactivar (apaga el crédito en toda la empresa)
-- pero no eliminar ni dejar de ser crédito.
CREATE OR REPLACE FUNCTION proteger_metodo_credito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.es_credito AND (
    NEW.es_credito IS DISTINCT FROM OLD.es_credito
    OR NEW.eliminado IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El método Crédito no se puede eliminar ni modificar; solo desactivar.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_metodo_credito ON metodos_pago;
CREATE TRIGGER trg_proteger_metodo_credito
  BEFORE UPDATE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION proteger_metodo_credito();

-- ----------------------------------------------------------------------------
-- 2. monto_credito en el pedido (solo lo escriben las RPC)
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_cabecera
  ADD COLUMN IF NOT EXISTS monto_credito NUMERIC(12,2) NOT NULL DEFAULT 0
  CHECK (monto_credito >= 0);

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
  IF NEW.total_pagado IS DISTINCT FROM OLD.total_pagado THEN
    RAISE EXCEPTION 'Los pagos de un pedido solo se pueden registrar a través de las funciones transaccionales del sistema.';
  END IF;
  IF NEW.monto_credito IS DISTINCT FROM OLD.monto_credito THEN
    RAISE EXCEPTION 'El crédito de un pedido solo se puede registrar a través de las funciones transaccionales del sistema.';
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

-- ----------------------------------------------------------------------------
-- 3. Permisos por perfil: credito_roles (y soporte/gerencia siempre)
-- ----------------------------------------------------------------------------
ALTER TABLE configuracion_sistema
  ADD COLUMN IF NOT EXISTS credito_roles TEXT[] NOT NULL DEFAULT ARRAY['soporte', 'gerencia'];

-- Soporte y gerencia siempre incluidos, también en el permiso que ya existía.
UPDATE configuracion_sistema
  SET precio_manual_roles = ARRAY(
    SELECT DISTINCT r FROM unnest(precio_manual_roles || ARRAY['soporte', 'gerencia']) AS r
  );

ALTER TABLE configuracion_sistema
  DROP CONSTRAINT IF EXISTS configuracion_sistema_credito_roles_check,
  ADD CONSTRAINT configuracion_sistema_credito_roles_check
    CHECK (
      credito_roles <@ ARRAY['soporte', 'gerencia', 'despachador', 'repartidor', 'cajera']::TEXT[]
      AND credito_roles @> ARRAY['soporte', 'gerencia']::TEXT[]
    );

ALTER TABLE configuracion_sistema
  DROP CONSTRAINT IF EXISTS configuracion_sistema_precio_manual_roles_siempre_check,
  ADD CONSTRAINT configuracion_sistema_precio_manual_roles_siempre_check
    CHECK (precio_manual_roles @> ARRAY['soporte', 'gerencia']::TEXT[]);

-- La actualiza soporte/gerencia con la política de UPDATE ya existente de
-- configuracion_sistema (mismo mecanismo que precio_manual_roles).

-- ¿El perfil del usuario autenticado puede entregar a crédito? Uso interno de
-- las RPC de cobro; no se expone por la API.
CREATE OR REPLACE FUNCTION usuario_puede_dar_credito()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT obtener_rol_actual() = ANY (c.credito_roles) FROM configuracion_sistema c),
    false
  );
$$;

REVOKE ALL ON FUNCTION usuario_puede_dar_credito() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. registrar_pagos: el crédito no es dinero, nunca entra al libro de pagos
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20260921100000_metodos_pago_y_pagos.sql; solo se agrega
-- `AND NOT es_credito` en la validación del método. Protege abonos, pagos de
-- compras y cualquier otro llamador de recibir 'Crédito' como medio de pago.
CREATE OR REPLACE FUNCTION registrar_pagos(
  p_pedido_id UUID,
  p_compra_id UUID,
  p_tipo TEXT,
  p_pagos JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metodos_activo BOOLEAN;
  v_efectivo_id UUID;
  v_item JSONB;
  v_monto NUMERIC(12,2);
  v_metodo_id UUID;
  v_suma NUMERIC := 0;
BEGIN
  IF p_pagos IS NULL OR jsonb_typeof(p_pagos) <> 'array' THEN
    RAISE EXCEPTION 'Los pagos deben enviarse como una lista.';
  END IF;

  SELECT metodos_pago_activo INTO v_metodos_activo FROM configuracion_sistema;
  SELECT id INTO v_efectivo_id FROM metodos_pago WHERE es_efectivo AND eliminado IS NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagos)
  LOOP
    v_monto := round((v_item->>'monto')::NUMERIC, 2);
    IF v_monto IS NULL OR v_monto <= 0 THEN
      RAISE EXCEPTION 'Cada pago debe tener un monto mayor a 0.';
    END IF;

    IF v_metodos_activo THEN
      v_metodo_id := NULLIF(v_item->>'metodo_pago_id', '')::UUID;
      IF v_metodo_id IS NULL THEN
        RAISE EXCEPTION 'Debe seleccionar el método de pago de cada pago.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM metodos_pago
        WHERE id = v_metodo_id AND estado = true AND eliminado IS NULL AND NOT es_credito
      ) THEN
        RAISE EXCEPTION 'El método de pago seleccionado no existe o está inactivo.';
      END IF;
    ELSE
      v_metodo_id := v_efectivo_id;
    END IF;

    INSERT INTO pagos (pedido_id, compra_id, metodo_pago_id, tipo, monto)
    VALUES (p_pedido_id, p_compra_id, v_metodo_id, p_tipo, v_monto);

    v_suma := v_suma + v_monto;
  END LOOP;

  RETURN v_suma;
END;
$$;

REVOKE ALL ON FUNCTION registrar_pagos(UUID, UUID, TEXT, JSONB) FROM PUBLIC, authenticated;

-- ----------------------------------------------------------------------------
-- 5. cobrar_saldo_pedido: acepta una línea 'Crédito' con permiso
-- ----------------------------------------------------------------------------
-- Las líneas con el método Crédito no se registran como pago: quedan como
-- saldo a deber en monto_credito. Debe cumplirse siempre:
--   dinero cobrado + crédito = saldo exacto.
-- Todas las RPC de entrega (despacho, repartidor, sin despacho, venta
-- directa) pasan por aquí, así la regla vive en un solo lugar.
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
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
BEGIN
  SELECT COALESCE(total, 0) - total_pagado INTO v_saldo
    FROM pedidos_cabecera
    WHERE id = p_pedido_id;

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

-- ----------------------------------------------------------------------------
-- 6. registrar_abono_pedido: también sobre pedidos entregados con saldo
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que la versión vigente; solo se agrega 'entregado' a los
-- estados permitidos (un entregado solo puede tener saldo si se entregó a
-- crédito) y se rechaza abonar un pedido sin saldo.
CREATE OR REPLACE FUNCTION registrar_abono_pedido(
  p_pedido_id UUID,
  p_pagos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_abonado NUMERIC;
  v_saldo NUMERIC;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar abonos.';
  END IF;

  IF NOT (SELECT abonos_pedidos_activo FROM configuracion_sistema) THEN
    RAISE EXCEPTION 'Los abonos a pedidos no están habilitados.';
  END IF;

  SELECT id, estado, COALESCE(total, 0) AS total, total_pagado INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o fue eliminado.';
  END IF;

  IF v_pedido.estado NOT IN ('pendiente', 'despachado', 'entregado') THEN
    RAISE EXCEPTION 'Solo se pueden registrar abonos en pedidos pendientes, despachados o entregados con saldo (actual: %).', v_pedido.estado;
  END IF;

  v_saldo := v_pedido.total - v_pedido.total_pagado;

  IF v_saldo <= 0 THEN
    RAISE EXCEPTION 'El pedido ya está pagado por completo.';
  END IF;

  v_abonado := registrar_pagos(p_pedido_id, NULL, 'abono', p_pagos);

  IF v_abonado <= 0 THEN
    RAISE EXCEPTION 'Debe registrar al menos un pago.';
  END IF;

  IF v_abonado > v_saldo THEN
    RAISE EXCEPTION 'El abono (%) supera el saldo pendiente del pedido (%).', v_abonado, v_saldo;
  END IF;

  RETURN jsonb_build_object(
    'pedido_id', p_pedido_id,
    'abonado', v_abonado,
    'saldo', v_saldo - v_abonado
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION registrar_abono_pedido(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_abono_pedido(UUID, JSONB) TO authenticated;
