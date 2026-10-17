-- ============================================================================
-- Límite de facturación electrónica automática (IngeFact / DIAN)
-- ============================================================================
-- Nueva configuración en "Pagos y Facturación":
--   facturacion_limite_tipo  : 'ilimitada' (como siempre) | 'mensual' | 'diaria'
--   facturacion_limite_valor : tope en pesos del total facturado en el periodo
--
-- Reglas (definidas con el usuario, 2026-10-17):
--   * Solo limita la facturación AUTOMÁTICA. El botón manual «Enviar Factura»
--     (soporte/gerencia) no se bloquea, pero sus facturas sí suman al total.
--   * Total del periodo = suma de las facturas VIGENTES emitidas en el periodo
--     (día o mes calendario en America/Bogota) + las que están emitiéndose en
--     este momento. Las anuladas (nota crédito) no cuentan: restan.
--   * Con T = total del periodo, L = límite y V = valor de la factura nueva:
--       - T >= L            -> no se factura («límite alcanzado»).
--       - T + V <= L        -> se factura.
--       - L < T + V <= 1.1 L -> se factura (tolerancia del 10 %); a partir de
--                              ahí T >= L y las siguientes ya no salen.
--       - T + V > 1.1 L     -> esta factura NO se envía, pero la siguiente se
--                              evalúa de nuevo (puede ser más pequeña).
--   * Una factura no enviada queda en ingefact_estado = 'limite_alcanzado' con
--     el motivo en ingefact_error; no se reintenta sola. Se puede emitir a
--     mano con el botón o, tras subir el límite/cambiar de periodo, volver a
--     entregarla.
--
-- La fuente de verdad es iniciar_operacion_ingefact(): evalúa el límite y toma
-- el candado del pedido en la misma transacción, bajo un advisory lock, para
-- que dos entregas simultáneas no se pasen del tope a la vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuración
-- ----------------------------------------------------------------------------
ALTER TABLE configuracion_sistema
  ADD COLUMN IF NOT EXISTS facturacion_limite_tipo TEXT NOT NULL DEFAULT 'ilimitada',
  ADD COLUMN IF NOT EXISTS facturacion_limite_valor NUMERIC(14,2);

ALTER TABLE configuracion_sistema
  DROP CONSTRAINT IF EXISTS configuracion_sistema_facturacion_limite_check,
  ADD CONSTRAINT configuracion_sistema_facturacion_limite_check
    CHECK (
      facturacion_limite_tipo IN ('ilimitada', 'mensual', 'diaria')
      AND (
        facturacion_limite_tipo = 'ilimitada'
        OR (facturacion_limite_valor IS NOT NULL AND facturacion_limite_valor > 0)
      )
    );

COMMENT ON COLUMN configuracion_sistema.facturacion_limite_tipo IS
  'Límite de facturación electrónica automática: ilimitada, mensual o diaria (America/Bogota).';
COMMENT ON COLUMN configuracion_sistema.facturacion_limite_valor IS
  'Tope en pesos del total facturado en el periodo. NULL si es ilimitada.';

-- ----------------------------------------------------------------------------
-- 2. Valor facturado por pedido y estado «límite alcanzado»
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_cabecera
  ADD COLUMN IF NOT EXISTS ingefact_total NUMERIC(12,2);

COMMENT ON COLUMN pedidos_cabecera.ingefact_total IS
  'Valor de la factura emitida en IngeFact (para sumar contra el límite de facturación).';

UPDATE pedidos_cabecera
  SET ingefact_total = COALESCE(total, 0)
  WHERE ingefact_factura_id IS NOT NULL
    AND ingefact_total IS NULL;

ALTER TABLE pedidos_cabecera
  DROP CONSTRAINT IF EXISTS pedidos_cabecera_ingefact_estado_check,
  ADD CONSTRAINT pedidos_cabecera_ingefact_estado_check
    CHECK (ingefact_estado IN (
      'facturando', 'facturada', 'error_facturacion',
      'anulando', 'anulada', 'error_anulacion',
      'limite_alcanzado'
    ));

CREATE INDEX IF NOT EXISTS idx_pedidos_ingefact_vigentes_enviado_en
  ON pedidos_cabecera (ingefact_enviado_en)
  WHERE ingefact_factura_id IS NOT NULL AND ingefact_anulado_en IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Cálculo del periodo y del total facturado
-- ----------------------------------------------------------------------------
-- Inicio del día/mes actual en hora de Colombia.
CREATE OR REPLACE FUNCTION inicio_periodo_facturacion(p_tipo TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc(
           CASE p_tipo WHEN 'mensual' THEN 'month' ELSE 'day' END,
           NOW() AT TIME ZONE 'America/Bogota'
         ) AT TIME ZONE 'America/Bogota';
$$;

CREATE OR REPLACE FUNCTION fin_periodo_facturacion(p_tipo TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    (inicio_periodo_facturacion(p_tipo) AT TIME ZONE 'America/Bogota')
    + CASE p_tipo WHEN 'mensual' THEN INTERVAL '1 month' ELSE INTERVAL '1 day' END
  ) AT TIME ZONE 'America/Bogota';
$$;

-- Total del periodo: facturas vigentes emitidas en él + las que se están
-- emitiendo ahora (candado de menos de 10 minutos, como iniciar_operacion).
CREATE OR REPLACE FUNCTION total_facturado_periodo_ingefact(
  p_tipo TEXT,
  p_excluir_pedido UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(p.ingefact_total, p.total, 0)), 0)
  FROM pedidos_cabecera p
  WHERE p.id IS DISTINCT FROM p_excluir_pedido
    AND (
      (p.ingefact_factura_id IS NOT NULL
        AND p.ingefact_anulado_en IS NULL
        AND p.ingefact_enviado_en >= inicio_periodo_facturacion(p_tipo)
        AND p.ingefact_enviado_en <  fin_periodo_facturacion(p_tipo))
      OR
      (p.ingefact_estado = 'facturando'
        AND p.ingefact_en_curso_desde > NOW() - INTERVAL '10 minutes'
        AND p.ingefact_en_curso_desde >= inicio_periodo_facturacion(p_tipo)
        AND p.ingefact_en_curso_desde <  fin_periodo_facturacion(p_tipo))
    );
$$;

REVOKE EXECUTE ON FUNCTION total_facturado_periodo_ingefact(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION total_facturado_periodo_ingefact(TEXT, UUID) TO service_role;

-- Pesos con separador de miles colombiano para los mensajes.
CREATE OR REPLACE FUNCTION formato_pesos_mensaje(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '$' || replace(to_char(round(p_valor), 'FM999,999,999,999,990'), ',', '.');
$$;

-- ----------------------------------------------------------------------------
-- 4. Consumo del límite para mostrar en Pagos y Facturación
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_consumo_limite_facturacion()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar el límite de facturación.';
  END IF;

  SELECT facturacion_limite_tipo, facturacion_limite_valor
    INTO v_config
    FROM configuracion_sistema;

  IF v_config.facturacion_limite_tipo = 'ilimitada' THEN
    RETURN jsonb_build_object('tipo', 'ilimitada');
  END IF;

  RETURN jsonb_build_object(
    'tipo', v_config.facturacion_limite_tipo,
    'limite', v_config.facturacion_limite_valor,
    'facturado', total_facturado_periodo_ingefact(v_config.facturacion_limite_tipo)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION obtener_consumo_limite_facturacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION obtener_consumo_limite_facturacion() TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. iniciar_operacion_ingefact: evalúa el límite en la emisión automática
-- ----------------------------------------------------------------------------
CREATE FUNCTION iniciar_operacion_ingefact(
  p_pedido_id UUID,
  p_accion TEXT,
  p_forzar BOOLEAN DEFAULT false,
  p_automatico BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_config RECORD;
  v_factura_vigente BOOLEAN;
  v_total_periodo NUMERIC;
  v_valor NUMERIC;
  v_periodo TEXT;
  v_motivo TEXT;
BEGIN
  IF p_accion NOT IN ('facturar', 'anular') THEN
    RAISE EXCEPTION 'Acción inválida: %', p_accion;
  END IF;

  SELECT estado, total, ingefact_factura_id, ingefact_anulado_en, ingefact_en_curso_desde
    INTO v_pedido
    FROM pedidos_cabecera
    WHERE id = p_pedido_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'Pedido no encontrado.';
  END IF;

  IF v_pedido.ingefact_en_curso_desde IS NOT NULL
     AND NOT (p_forzar AND v_pedido.ingefact_en_curso_desde < NOW() - INTERVAL '10 minutes') THEN
    RETURN 'Ya hay una operación con IngeFact en curso para este pedido.';
  END IF;

  v_factura_vigente :=
    v_pedido.ingefact_factura_id IS NOT NULL AND v_pedido.ingefact_anulado_en IS NULL;

  IF p_accion = 'facturar' THEN
    IF v_factura_vigente THEN
      RETURN 'Este pedido ya fue facturado en IngeFact.';
    END IF;
    IF v_pedido.estado <> 'entregado' THEN
      RETURN 'Solo se pueden facturar pedidos ya entregados.';
    END IF;

    -- Límite: solo la emisión automática. El advisory lock serializa la
    -- evaluación + el marcado como «facturando» de pedidos simultáneos.
    IF p_automatico THEN
      SELECT facturacion_limite_tipo AS tipo, facturacion_limite_valor AS limite
        INTO v_config
        FROM configuracion_sistema;

      IF v_config.tipo <> 'ilimitada' THEN
        PERFORM pg_advisory_xact_lock(hashtext('limite_facturacion_ingefact'));

        v_total_periodo := total_facturado_periodo_ingefact(v_config.tipo, p_pedido_id);
        v_valor := COALESCE(v_pedido.total, 0);
        v_periodo := CASE v_config.tipo WHEN 'mensual' THEN 'mensual' ELSE 'diario' END;

        IF v_total_periodo >= v_config.limite THEN
          v_motivo := format(
            'Límite de facturación %s alcanzado: ya se facturaron %s de %s. Se puede enviar a mano con «Enviar Factura».',
            v_periodo, formato_pesos_mensaje(v_total_periodo), formato_pesos_mensaje(v_config.limite)
          );
        ELSIF v_total_periodo + v_valor > v_config.limite * 1.10 THEN
          v_motivo := format(
            'Esta factura (%s) superaría el límite %s de %s en más del 10 %%: ya se facturaron %s. Se puede enviar a mano con «Enviar Factura».',
            formato_pesos_mensaje(v_valor), v_periodo,
            formato_pesos_mensaje(v_config.limite), formato_pesos_mensaje(v_total_periodo)
          );
        END IF;

        IF v_motivo IS NOT NULL THEN
          UPDATE pedidos_cabecera
            SET ingefact_estado = 'limite_alcanzado',
                ingefact_error = v_motivo
            WHERE id = p_pedido_id;
          RETURN v_motivo;
        END IF;
      END IF;
    END IF;
  ELSE
    IF NOT v_factura_vigente THEN
      RETURN 'Este pedido no tiene una factura vigente para anular.';
    END IF;
    IF v_pedido.estado = 'entregado' THEN
      RETURN 'No se anula la factura de un pedido entregado.';
    END IF;
  END IF;

  UPDATE pedidos_cabecera
    SET ingefact_estado = CASE p_accion WHEN 'facturar' THEN 'facturando' ELSE 'anulando' END,
        ingefact_error = NULL,
        ingefact_en_curso_desde = NOW()
    WHERE id = p_pedido_id;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;

-- Compatibilidad: la Edge Function anterior llama con 3 argumentos. Se
-- conserva esa firma (sin límite, como antes) para que desplegar la función
-- nueva no tenga que coincidir al segundo con esta migración.
CREATE OR REPLACE FUNCTION iniciar_operacion_ingefact(
  p_pedido_id UUID,
  p_accion TEXT,
  p_forzar BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT iniciar_operacion_ingefact(p_pedido_id, p_accion, p_forzar, false);
$$;

REVOKE EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN) TO service_role;
