-- ============================================================================
-- Auditoría en todas las tablas de negocio + soft delete obligatorio
-- ============================================================================
-- Hasta ahora solo pedidos_cabecera, cotizaciones_cabecera, tomas_fisicas,
-- perfiles y roles tenían trigger de auditoría; el resto (pagos, clientes,
-- productos, compras, despachos, precios, costos, configuración...) se podía
-- modificar sin dejar rastro. Además `pagos` no tenía soft delete y dos
-- tablas con columna `eliminado` (productos_precios y
-- productos_precios_mayoristas) se borraban físicamente desde el frontend.
--
-- Regla que fija esta migración (ver CLAUDE.md, "Auditoría y soft delete"):
--
--   1. Toda tabla de negocio tiene el trigger `audit_<tabla>` (INSERT,
--      UPDATE y DELETE) -> registrar_auditoria().
--   2. Las entidades con ciclo de vida propio (catálogos, cabeceras, pagos)
--      tienen soft delete (`eliminado`) y el trigger
--      `impedir_borrado_<tabla>`, que rechaza el DELETE físico.
--   3. Las filas de detalle (pedidos_detalle, cotizaciones_detalle, ...),
--      las tablas satélite 1:1 (productos_costos, pedidos_detalle_costos) y
--      las de fila única (configuracion_sistema, datos_empresa) no llevan
--      soft delete: viven y mueren con su cabecera/dueño, y las RPC de
--      edición las reemplazan completas. Su borrado físico queda en
--      `auditoria` con la fila anterior completa, así que es recuperable.
--
-- Excepciones deliberadas:
--   - auditoria: es el propio registro.
--   - auth_intentos_fallidos: contador técnico del login, no dato de negocio.
--   - perfiles: auditada y con soft delete, pero sin bloqueo de DELETE
--     porque su FK a auth.users es ON DELETE CASCADE (borrar el usuario de
--     Auth debe seguir funcionando).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. registrar_auditoria genérica
-- ----------------------------------------------------------------------------
-- Cambios respecto a la versión anterior:
--   - Tablas sin columna `id` (productos_costos, pedidos_detalle_costos): la
--     columna que identifica la fila se pasa como argumento del trigger.
--   - Compara las filas como jsonb: `NEW != OLD` falla en tablas con
--     columnas sin operador de igualdad (json, point...).
--   - search_path fijo, como el resto de funciones SECURITY DEFINER.
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columna_id TEXT := COALESCE(TG_ARGV[0], 'id');
  v_nueva JSONB;
  v_anterior JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_nueva := to_jsonb(NEW);
    INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos, usuario_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_nueva->>v_columna_id, v_nueva, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_nueva := to_jsonb(NEW);
    v_anterior := to_jsonb(OLD);
    IF v_nueva IS DISTINCT FROM v_anterior THEN
      INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id)
      VALUES (TG_TABLE_NAME, TG_OP, v_nueva->>v_columna_id, v_anterior, v_nueva, auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_anterior := to_jsonb(OLD);
    INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_anterior->>v_columna_id, v_anterior, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION registrar_auditoria() FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Bloqueo del borrado físico en tablas con soft delete
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION impedir_borrado_fisico()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de % no se borran físicamente; márquelos como eliminados (soft delete).', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

REVOKE EXECUTE ON FUNCTION impedir_borrado_fisico() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Soft delete en pagos
-- ----------------------------------------------------------------------------
-- `pagos` sigue siendo un libro: el monto, el método y el origen de un pago
-- no se editan nunca (una corrección de dinero es una 'devolucion'). Lo único
-- permitido es anular el movimiento (eliminado), una sola vez y sin vuelta
-- atrás; al anularlo, total_pagado de la cabecera se revierte.
ALTER TABLE pagos ADD COLUMN actualizado TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN eliminado TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION proteger_pagos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.eliminado IS NOT NULL THEN
      RAISE EXCEPTION 'Un pago no se puede registrar ya anulado.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.eliminado IS NOT NULL THEN
    RAISE EXCEPTION 'El pago ya está anulado y no se puede modificar.';
  END IF;
  IF NEW.eliminado IS NULL THEN
    RAISE EXCEPTION 'Un pago no se edita: registre una devolución o anúlelo.';
  END IF;
  IF (to_jsonb(NEW) - 'eliminado' - 'actualizado')
     IS DISTINCT FROM (to_jsonb(OLD) - 'eliminado' - 'actualizado') THEN
    RAISE EXCEPTION 'Al anular un pago no se pueden cambiar sus demás datos.';
  END IF;

  NEW.actualizado := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_pagos
  BEFORE INSERT OR UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION proteger_pagos();

-- total_pagado: un pago nuevo suma, un pago anulado revierte lo que sumó.
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
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.eliminado IS NULL AND NEW.eliminado IS NOT NULL) THEN
      RETURN NEW;
    END IF;
    v_delta := -v_delta;
  END IF;

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

DROP TRIGGER IF EXISTS trg_sincronizar_total_pagado ON pagos;
CREATE TRIGGER trg_sincronizar_total_pagado
  AFTER INSERT OR UPDATE OF eliminado ON pagos
  FOR EACH ROW EXECUTE FUNCTION sincronizar_total_pagado();

-- Las devoluciones se reparten solo sobre los pagos vigentes.
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
      WHERE eliminado IS NULL
        AND ((p_pedido_id IS NOT NULL AND pedido_id = p_pedido_id)
          OR (p_compra_id IS NOT NULL AND compra_id = p_compra_id))
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

-- ----------------------------------------------------------------------------
-- 4. Triggers de auditoría y de bloqueo de borrado
-- ----------------------------------------------------------------------------
-- Se recrean también los que ya existían (pedidos_cabecera,
-- cotizaciones_cabecera, tomas_fisicas) para que todos auditen DELETE.
DO $$
DECLARE
  -- tabla => columna que identifica la fila (NULL = 'id')
  v_auditadas CONSTANT JSONB := '{
    "clientes": null, "compras_cabecera": null, "compras_detalle": null,
    "configuracion_sistema": null, "cotizaciones_cabecera": null,
    "cotizaciones_detalle": null, "datos_empresa": null, "despachos": null,
    "despachos_pedidos": null, "metodos_pago": null, "municipios": null,
    "pagos": null, "pedidos_cabecera": null, "pedidos_detalle": null,
    "pedidos_detalle_costos": "pedido_detalle_id", "perfiles": null,
    "pies_factura": null, "productos": null, "productos_costos": "producto_id",
    "productos_precios": null, "productos_precios_mayoristas": null,
    "proveedores": null, "roles": null, "tipos_identificacion": null,
    "tipos_precio": null, "tomas_fisicas": null,
    "tomas_fisicas_detalle": null, "vehiculos": null
  }';
  v_sin_borrado_fisico CONSTANT TEXT[] := ARRAY[
    'clientes', 'compras_cabecera', 'cotizaciones_cabecera', 'despachos',
    'metodos_pago', 'municipios', 'pagos', 'pedidos_cabecera', 'pies_factura',
    'productos', 'productos_precios', 'productos_precios_mayoristas',
    'proveedores', 'roles', 'tipos_identificacion', 'tipos_precio',
    'tomas_fisicas', 'vehiculos'
  ];
  v_tabla TEXT;
  v_columna_id TEXT;
BEGIN
  FOR v_tabla, v_columna_id IN SELECT key, value #>> '{}' FROM jsonb_each(v_auditadas)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'audit_' || v_tabla, v_tabla);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION registrar_auditoria(%s)',
      'audit_' || v_tabla, v_tabla,
      CASE WHEN v_columna_id IS NULL THEN '' ELSE quote_literal(v_columna_id) END
    );
  END LOOP;

  FOREACH v_tabla IN ARRAY v_sin_borrado_fisico
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'impedir_borrado_' || v_tabla, v_tabla);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_borrado_fisico()',
      'impedir_borrado_' || v_tabla, v_tabla
    );
  END LOOP;
END;
$$;
