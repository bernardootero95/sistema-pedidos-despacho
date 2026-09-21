-- ============================================================================
-- Métodos de pago, abonos y pagos múltiples (pedidos y compras)
-- ============================================================================
-- Tres capacidades opcionales, activables por empresa desde la pantalla
-- "Opciones" (soporte/gerencia), independientes entre sí:
--   - metodos_pago_activo:   pedir/registrar el método de pago (Efectivo,
--                            Transferencia, etc.). Apagado = todo se asume
--                            Efectivo, como hasta ahora.
--   - abonos_pedidos_activo: permitir abonos a pedidos pendientes; al
--                            entregar se cobra el saldo restante.
--   - abonos_compras_activo: permitir registrar una compra con pago parcial
--                            y abonar al proveedor después.
--
-- Modelo:
--   - configuracion_sistema: fila única (cada empresa tiene su propio
--     proyecto Supabase, no hace falta tenant_id).
--   - metodos_pago: catálogo con su código DIAN (para la factura
--     electrónica). "Efectivo" se siembra y no se puede quitar.
--   - pagos: libro de movimientos de dinero de un pedido O de una compra,
--     solo-inserción (sin UPDATE/DELETE): un pago es un hecho, una
--     devolución se registra como un movimiento nuevo de tipo 'devolucion'.
--     Un pedido/compra puede tener varios pagos con métodos distintos.
--   - pedidos_cabecera.total_pagado / compras_cabecera.total_pagado: neto
--     (pagos - devoluciones) mantenido por trigger, para listar saldos sin
--     agregar sobre `pagos` en cada consulta. saldo = total - total_pagado.
--
-- Invariante nueva: un pedido 'entregado' siempre está pagado por completo
-- (el cobro del saldo es obligatorio al entregar). Los pedidos entregados y
-- las compras registradas que ya existen se migran como pagados en Efectivo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuración del sistema (fila única)
-- ----------------------------------------------------------------------------
CREATE TABLE configuracion_sistema (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  metodos_pago_activo BOOLEAN NOT NULL DEFAULT false,
  abonos_pedidos_activo BOOLEAN NOT NULL DEFAULT false,
  abonos_compras_activo BOOLEAN NOT NULL DEFAULT false,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

INSERT INTO configuracion_sistema DEFAULT VALUES;

CREATE TRIGGER set_timestamp_configuracion_sistema
  BEFORE UPDATE ON configuracion_sistema
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Todos los roles la leen (el repartidor necesita saber si debe cobrar).
CREATE POLICY "configuracion_sistema_select" ON configuracion_sistema
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IS NOT NULL);

CREATE POLICY "configuracion_sistema_update_admin" ON configuracion_sistema
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

-- Sin INSERT/DELETE: la fila única la siembra esta migración.
GRANT SELECT, UPDATE ON TABLE configuracion_sistema TO authenticated;
REVOKE ALL ON TABLE configuracion_sistema FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Catálogo de métodos de pago
-- ----------------------------------------------------------------------------
CREATE TABLE metodos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL CHECK (length(btrim(nombre)) > 0),
  -- Código DIAN de "medio de pago" que se envía en la factura electrónica
  -- (10 efectivo, 47 transferencia débito bancaria, 42 consignación, etc.).
  codigo_dian VARCHAR(3) NOT NULL DEFAULT '10' CHECK (length(codigo_dian) BETWEEN 2 AND 3),
  -- Marca el método por defecto (Efectivo): es el que se usa cuando la
  -- opción de métodos de pago está apagada, por eso no se puede quitar.
  es_efectivo BOOLEAN NOT NULL DEFAULT false,
  estado BOOLEAN DEFAULT true,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  eliminado TIMESTAMPTZ
);

CREATE UNIQUE INDEX metodos_pago_nombre_key
  ON metodos_pago (lower(nombre))
  WHERE eliminado IS NULL;

CREATE UNIQUE INDEX metodos_pago_efectivo_key
  ON metodos_pago (es_efectivo)
  WHERE es_efectivo;

CREATE TRIGGER set_timestamp_metodos_pago
  BEFORE UPDATE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE FUNCTION proteger_metodo_efectivo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.es_efectivo AND (
    NEW.es_efectivo IS DISTINCT FROM OLD.es_efectivo
    OR NEW.estado IS DISTINCT FROM true
    OR NEW.eliminado IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El método de pago por defecto (Efectivo) no se puede desactivar ni eliminar.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_metodo_efectivo
  BEFORE UPDATE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION proteger_metodo_efectivo();

ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metodos_pago_select_operativo" ON metodos_pago
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'repartidor', 'cajera'));

CREATE POLICY "metodos_pago_write_admin" ON metodos_pago
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

GRANT ALL ON TABLE metodos_pago TO authenticated;
REVOKE ALL ON TABLE metodos_pago FROM anon;

INSERT INTO metodos_pago (nombre, codigo_dian, es_efectivo) VALUES ('Efectivo', '10', true);

-- ----------------------------------------------------------------------------
-- 3. Libro de pagos (pedidos y compras)
-- ----------------------------------------------------------------------------
-- tipo: 'entrega' = cobro al entregar el pedido; 'pago' = pago al registrar
-- una compra; 'abono' = pago parcial posterior; 'devolucion' = dinero que se
-- regresa (anulación, o edición que baja el total por debajo de lo abonado).
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos_cabecera(id),
  compra_id UUID REFERENCES compras_cabecera(id),
  metodo_pago_id UUID NOT NULL REFERENCES metodos_pago(id),
  tipo VARCHAR(20) NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  -- NULL en los pagos migrados de datos históricos.
  registrado_por UUID REFERENCES perfiles(id) DEFAULT auth.uid(),
  creado TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL,
  CONSTRAINT pagos_un_solo_origen CHECK ((pedido_id IS NOT NULL) <> (compra_id IS NOT NULL)),
  CONSTRAINT pagos_tipo_segun_origen CHECK (
    (pedido_id IS NOT NULL AND tipo IN ('abono', 'entrega', 'devolucion'))
    OR (compra_id IS NOT NULL AND tipo IN ('pago', 'abono', 'devolucion'))
  )
);

CREATE INDEX pagos_pedido_id_idx ON pagos (pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX pagos_compra_id_idx ON pagos (compra_id) WHERE compra_id IS NOT NULL;
CREATE INDEX pagos_metodo_pago_id_idx ON pagos (metodo_pago_id);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Quien puede ver el pedido/compra (RLS de esas tablas) ve sus pagos.
CREATE POLICY "pagos_select_segun_origen" ON pagos
  FOR SELECT TO authenticated
  USING (
    (pedido_id IS NOT NULL AND EXISTS (SELECT 1 FROM pedidos_cabecera pc WHERE pc.id = pagos.pedido_id))
    OR (compra_id IS NOT NULL AND EXISTS (SELECT 1 FROM compras_cabecera cc WHERE cc.id = pagos.compra_id))
  );

-- Sin políticas de INSERT/UPDATE/DELETE: los pagos solo se registran dentro
-- de las RPC transaccionales (SECURITY DEFINER), mismo criterio que
-- pedidos_detalle / compras_detalle.
GRANT SELECT ON TABLE pagos TO authenticated;
REVOKE ALL ON TABLE pagos FROM anon;

-- ----------------------------------------------------------------------------
-- 4. total_pagado en las cabeceras
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_cabecera ADD COLUMN total_pagado NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE compras_cabecera ADD COLUMN total_pagado NUMERIC(12,2) NOT NULL DEFAULT 0;

-- total_pagado solo lo mueve el trigger de `pagos`; RLS filtra filas, no
-- columnas, así que un vendedor podría escribirlo directo sobre su pedido
-- pendiente sin esta protección (mismo hallazgo que motivó
-- bloquear_edicion_directa_pedido).
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
-- 5. Migración de datos: lo ya entregado/registrado queda pagado en Efectivo
-- ----------------------------------------------------------------------------
INSERT INTO pagos (pedido_id, metodo_pago_id, tipo, monto, registrado_por, creado)
SELECT pc.id, m.id, 'entrega', pc.total, NULL,
       COALESCE(pc.fecha_entrega, pc.actualizado, pc.creado, now())
FROM pedidos_cabecera pc
CROSS JOIN metodos_pago m
WHERE m.es_efectivo
  AND pc.estado = 'entregado'
  AND pc.eliminado IS NULL
  AND pc.total > 0;

INSERT INTO pagos (compra_id, metodo_pago_id, tipo, monto, registrado_por, creado)
SELECT cc.id, m.id, 'pago', cc.total, NULL,
       COALESCE(cc.fecha_compra, cc.creado, now())
FROM compras_cabecera cc
CROSS JOIN metodos_pago m
WHERE m.es_efectivo
  AND cc.estado = 'registrada'
  AND cc.eliminado IS NULL
  AND cc.total > 0;

-- Sin ruido en la auditoría: es un backfill, no un cambio hecho por un
-- usuario (el trigger de sincronización aún no existe en este punto).
ALTER TABLE pedidos_cabecera DISABLE TRIGGER audit_pedidos_cabecera;
SELECT set_config('app.rpc_autorizado', 'true', true);

UPDATE pedidos_cabecera pc
SET total_pagado = p.pagado
FROM (SELECT pedido_id, SUM(monto) AS pagado FROM pagos WHERE pedido_id IS NOT NULL GROUP BY pedido_id) p
WHERE p.pedido_id = pc.id;

UPDATE compras_cabecera cc
SET total_pagado = p.pagado
FROM (SELECT compra_id, SUM(monto) AS pagado FROM pagos WHERE compra_id IS NOT NULL GROUP BY compra_id) p
WHERE p.compra_id = cc.id;

SELECT set_config('app.rpc_autorizado', '', true);
ALTER TABLE pedidos_cabecera ENABLE TRIGGER audit_pedidos_cabecera;

-- ----------------------------------------------------------------------------
-- 6. Trigger: cada movimiento en `pagos` actualiza total_pagado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sincronizar_total_pagado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC := CASE WHEN NEW.tipo = 'devolucion' THEN -NEW.monto ELSE NEW.monto END;
  v_bandera_previa TEXT := current_setting('app.rpc_autorizado', true);
BEGIN
  IF NEW.pedido_id IS NOT NULL THEN
    PERFORM set_config('app.rpc_autorizado', 'true', true);
    UPDATE pedidos_cabecera
      SET total_pagado = total_pagado + v_delta
      WHERE id = NEW.pedido_id;
    -- Restaura la bandera: no debe quedar abierta para el resto de la transacción.
    PERFORM set_config('app.rpc_autorizado', COALESCE(v_bandera_previa, ''), true);
  ELSE
    UPDATE compras_cabecera
      SET total_pagado = total_pagado + v_delta
      WHERE id = NEW.compra_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sincronizar_total_pagado
  AFTER INSERT ON pagos
  FOR EACH ROW EXECUTE FUNCTION sincronizar_total_pagado();

-- ----------------------------------------------------------------------------
-- 7. Funciones internas (solo las llaman otras RPC, no el cliente)
-- ----------------------------------------------------------------------------

-- Registra los pagos de un pedido o compra. p_pagos = [{ "metodo_pago_id":
-- "...", "monto": 1000 }, ...]. Con métodos de pago apagado el método se
-- ignora y todo se registra en Efectivo. Devuelve la suma registrada.
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
        WHERE id = v_metodo_id AND estado = true AND eliminado IS NULL
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

-- Registra devoluciones por un monto total, repartiéndolas entre los
-- métodos con dinero neto pendiente de devolver, del pago más reciente al
-- más antiguo (se devuelve por donde entró el último dinero).
CREATE OR REPLACE FUNCTION devolver_pagos(
  p_pedido_id UUID,
  p_compra_id UUID,
  p_monto NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante NUMERIC := p_monto;
  v_metodo RECORD;
  v_devolver NUMERIC;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN;
  END IF;

  FOR v_metodo IN
    SELECT metodo_pago_id,
           SUM(CASE WHEN tipo = 'devolucion' THEN -monto ELSE monto END) AS neto
      FROM pagos
      WHERE (p_pedido_id IS NOT NULL AND pedido_id = p_pedido_id)
         OR (p_compra_id IS NOT NULL AND compra_id = p_compra_id)
      GROUP BY metodo_pago_id
      HAVING SUM(CASE WHEN tipo = 'devolucion' THEN -monto ELSE monto END) > 0
      ORDER BY MAX(creado) DESC
  LOOP
    v_devolver := LEAST(v_restante, v_metodo.neto);
    INSERT INTO pagos (pedido_id, compra_id, metodo_pago_id, tipo, monto)
    VALUES (p_pedido_id, p_compra_id, v_metodo.metodo_pago_id, 'devolucion', v_devolver);

    v_restante := v_restante - v_devolver;
    EXIT WHEN v_restante <= 0;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION devolver_pagos(UUID, UUID, NUMERIC) FROM PUBLIC, authenticated;

-- Cobra el saldo de un pedido al entregarlo. El llamador ya bloqueó la fila
-- del pedido. Regla: el cobro debe cubrir el saldo exacto; con métodos de
-- pago apagado y sin pagos explícitos, el saldo se cobra en Efectivo.
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
  v_cobrado NUMERIC;
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
BEGIN
  SELECT COALESCE(total, 0) - total_pagado INTO v_saldo
    FROM pedidos_cabecera
    WHERE id = p_pedido_id;

  IF v_saldo <= 0 THEN
    IF v_hay_pagos THEN
      RAISE EXCEPTION 'El pedido ya está pagado por completo; no hay saldo por cobrar.';
    END IF;
    RETURN;
  END IF;

  SELECT metodos_pago_activo INTO v_metodos_activo FROM configuracion_sistema;

  IF NOT v_hay_pagos THEN
    IF v_metodos_activo THEN
      RAISE EXCEPTION 'Debe registrar el pago del saldo pendiente (%) antes de entregar.', v_saldo;
    END IF;
    p_pagos := jsonb_build_array(jsonb_build_object('monto', v_saldo));
  END IF;

  v_cobrado := registrar_pagos(p_pedido_id, NULL, 'entrega', p_pagos);

  IF v_cobrado <> v_saldo THEN
    RAISE EXCEPTION 'El pago debe cubrir exactamente el saldo pendiente (%). Se recibió %.', v_saldo, v_cobrado;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION cobrar_saldo_pedido(UUID, JSONB) FROM PUBLIC, authenticated;
