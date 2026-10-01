-- ============================================================================
-- Facturación electrónica automática (IngeFact)
-- ============================================================================
-- Nueva opción `facturacion_automatica_activo` (pantalla "Opciones"):
--   - Encendida: cada pedido que pasa a 'entregado' (entrega individual,
--     despacho completado o venta directa que nace entregada) se factura
--     solo en IngeFact.
--   - Siempre (encendida o no): si un pedido con factura vigente deja de
--     estar 'entregado' (anulado, devuelto o entrega revertida), la factura
--     se anula con una nota crédito por el 100%. Una factura emitida a mano
--     con el botón también se anula: el interruptor solo controla la
--     EMISIÓN automática.
--
-- Cómo llega del cambio de estado a IngeFact:
--   La llamada HTTP a IngeFact no puede vivir en una transacción de Postgres
--   (como el resto de operaciones críticas), así que el trigger
--   `trg_encolar_operacion_ingefact` solo ENCOLA un POST a la Edge Function
--   enviar-factura-ingefact vía pg_net. pg_net despacha la cola después del
--   COMMIT: si la transacción que entregó/anuló el pedido se revierte, la
--   llamada nunca sale. La Edge Function hace el trabajo y deja el resultado
--   (o el error) en las columnas ingefact_* del pedido.
--
-- Autenticación trigger -> Edge Function: un secreto aleatorio generado
-- aquí y guardado en Vault (`facturacion_ingefact_secreto`), enviado en el
-- header x-facturacion-secreto. La Edge Function lo valida con
-- validar_secreto_facturacion_ingefact() (solo service_role), así no hay
-- que copiarlo a mano a los secrets de la función.
--
-- Configuración por proyecto (una vez, fuera de esta migración, porque la
-- URL depende del proyecto):
--   SELECT vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/enviar-factura-ingefact',
--     'facturacion_ingefact_url');
-- Sin ella, el pedido queda con ingefact_estado = 'error_*' y el mensaje
-- de qué falta, en vez de fallar la entrega/anulación.
--
-- Concurrencia: `ingefact_en_curso_desde` es un candado por pedido que toma
-- iniciar_operacion_ingefact() con UPDATE condicional (atómico), para que la
-- llamada automática y el botón manual nunca emitan dos facturas del mismo
-- pedido.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. Opción
-- ----------------------------------------------------------------------------
ALTER TABLE configuracion_sistema
  ADD COLUMN facturacion_automatica_activo BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Estado de la facturación en el pedido
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_cabecera
  ADD COLUMN ingefact_estado TEXT
    CHECK (ingefact_estado IN (
      'facturando', 'facturada', 'error_facturacion',
      'anulando', 'anulada', 'error_anulacion'
    )),
  ADD COLUMN ingefact_error TEXT,
  ADD COLUMN ingefact_en_curso_desde TIMESTAMPTZ,
  ADD COLUMN ingefact_nota_credito_id UUID,
  ADD COLUMN ingefact_numero_nota_credito CHARACTER VARYING(50),
  ADD COLUMN ingefact_anulado_en TIMESTAMPTZ;

COMMENT ON COLUMN pedidos_cabecera.ingefact_estado IS
  'Último estado de la operación con IngeFact. NULL = nunca se intentó facturar.';
COMMENT ON COLUMN pedidos_cabecera.ingefact_error IS
  'Mensaje del último error al facturar/anular en IngeFact (NULL si la última operación salió bien).';
COMMENT ON COLUMN pedidos_cabecera.ingefact_en_curso_desde IS
  'Candado: momento en que empezó la operación con IngeFact en curso. NULL = ninguna en curso.';
COMMENT ON COLUMN pedidos_cabecera.ingefact_nota_credito_id IS
  'ID de la nota crédito de anulación en IngeFact.';
COMMENT ON COLUMN pedidos_cabecera.ingefact_numero_nota_credito IS
  'Número completo de la nota crédito de anulación, para mostrar en el detalle.';
COMMENT ON COLUMN pedidos_cabecera.ingefact_anulado_en IS
  'Fecha/hora en que se anuló la factura. Factura vigente = ingefact_factura_id NOT NULL y esta columna NULL.';

UPDATE pedidos_cabecera
  SET ingefact_estado = 'facturada'
  WHERE ingefact_factura_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Secreto compartido trigger -> Edge Function
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'facturacion_ingefact_secreto') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''),
      'facturacion_ingefact_secreto',
      'Autentica las llamadas de trg_encolar_operacion_ingefact a la Edge Function enviar-factura-ingefact.'
    );
  END IF;
END;
$$;

CREATE FUNCTION validar_secreto_facturacion_ingefact(p_secreto TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'facturacion_ingefact_secreto'
      AND decrypted_secret = p_secreto
  );
$$;

REVOKE EXECUTE ON FUNCTION validar_secreto_facturacion_ingefact(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION validar_secreto_facturacion_ingefact(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Trigger: encola facturar/anular según la transición de estado
-- ----------------------------------------------------------------------------
-- BEFORE (no AFTER) para poder dejar el error de configuración en la misma
-- fila sin un segundo UPDATE.
CREATE FUNCTION encolar_operacion_ingefact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_previo TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END;
  v_factura_vigente BOOLEAN :=
    NEW.ingefact_factura_id IS NOT NULL AND NEW.ingefact_anulado_en IS NULL;
  v_accion TEXT;
  v_url TEXT;
  v_secreto TEXT;
BEGIN
  IF NEW.eliminado IS NOT NULL OR NEW.estado IS NOT DISTINCT FROM v_estado_previo THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'entregado'
     AND NOT v_factura_vigente
     AND (SELECT facturacion_automatica_activo FROM configuracion_sistema) THEN
    v_accion := 'facturar';
  ELSIF NEW.estado <> 'entregado' AND v_factura_vigente THEN
    v_accion := 'anular';
  END IF;

  IF v_accion IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'facturacion_ingefact_url';
  SELECT decrypted_secret INTO v_secreto
    FROM vault.decrypted_secrets WHERE name = 'facturacion_ingefact_secreto';

  IF v_url IS NULL OR v_secreto IS NULL THEN
    NEW.ingefact_estado := CASE v_accion WHEN 'facturar' THEN 'error_facturacion' ELSE 'error_anulacion' END;
    NEW.ingefact_error := 'La facturación automática no está configurada en este servidor (falta el secret facturacion_ingefact_url en Vault).';
    RETURN NEW;
  END IF;

  -- Timeout amplio: la Edge Function espera la respuesta de la DIAN.
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('pedido_id', NEW.id, 'accion', v_accion),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-facturacion-secreto', v_secreto
    ),
    timeout_milliseconds := 60000
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_encolar_operacion_ingefact
  BEFORE INSERT OR UPDATE OF estado ON pedidos_cabecera
  FOR EACH ROW EXECUTE FUNCTION encolar_operacion_ingefact();

-- ----------------------------------------------------------------------------
-- 5. Candado por pedido para la Edge Function
-- ----------------------------------------------------------------------------
-- Toma el candado si el pedido está en condiciones para la acción pedida.
-- Devuelve NULL si lo tomó, o el motivo por el que no (para responderlo tal
-- cual). Un candado de más de 10 minutos se considera abandonado (la
-- función murió a mitad de camino), pero solo se puede forzar desde el botón
-- manual (p_forzar): reintentarlo solo podría duplicar una factura que sí
-- alcanzó a emitirse, así que lo decide una persona.
CREATE FUNCTION iniciar_operacion_ingefact(
  p_pedido_id UUID,
  p_accion TEXT,
  p_forzar BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_factura_vigente BOOLEAN;
BEGIN
  IF p_accion NOT IN ('facturar', 'anular') THEN
    RAISE EXCEPTION 'Acción inválida: %', p_accion;
  END IF;

  SELECT estado, ingefact_factura_id, ingefact_anulado_en, ingefact_en_curso_desde
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

REVOKE EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION iniciar_operacion_ingefact(UUID, TEXT, BOOLEAN) TO service_role;
