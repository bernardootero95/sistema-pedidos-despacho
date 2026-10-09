-- ============================================================================
-- Informes de inventario y toma física (soporte/gerencia)
-- ============================================================================
-- Contexto: `productos.disponible` es la mercancía LIBRE. Se descuenta al
-- CREAR el pedido (no al entregarlo) y vuelve al anular un pedido pendiente
-- o despachado. Lo que hay realmente en la bodega es, entonces:
--
--     físico = disponible + pendiente por entregar
--
-- donde "pendiente por entregar" = líneas de pedidos 'pendiente'/'despachado'.
-- No existe un historial de movimientos de inventario, así que el informe por
-- rango reconstruye hacia atrás desde el estado actual con los eventos que sí
-- tienen fecha (compras, entregas y ajustes de toma física):
--
--     físico final   = físico actual − compras posteriores + entregas
--                      posteriores − ajustes posteriores
--     inicial        = físico final − compras del rango + entregas del rango
--                      − ajustes del rango
--     disponible     = físico final − preventa al cierre
--
-- Limitación conocida (decidida con el usuario): los cambios de stock hechos
-- por la carga de Excel o editando `disponible` a mano no quedan registrados,
-- por lo que el inicial de un rango en que ocurrieron no cuadra al 100 %. Las
-- tomas físicas SÍ se registran (columna `diferencia`) y entran al cálculo.
-- El costo se valora con el último costo conocido (`productos_costos`).
--
-- Esta migración agrega:
--   1. RPC obtener_informe_inventario (rango de fechas).
--   2. RPC obtener_inventario_actual (bodega hoy: disponible + pendiente).
--   3. tomas_fisicas / tomas_fisicas_detalle y sus RPC transaccionales
--      (crear, guardar conteo, aplicar, cancelar). El ajuste se aplica como
--      DELTA (contado − foto del sistema) sobre el stock vigente, para no
--      pisar las ventas que ocurran mientras se cuenta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tablas de toma física
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tomas_fisicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_toma VARCHAR(50) NOT NULL,
  usuario_id UUID NOT NULL REFERENCES perfiles(id),
  estado VARCHAR(20) DEFAULT 'borrador' NOT NULL,
  notas TEXT,
  fecha_aplicacion TIMESTAMPTZ,
  aplicada_por UUID REFERENCES perfiles(id),
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ,
  eliminado TIMESTAMPTZ,
  CONSTRAINT tomas_fisicas_numero_key UNIQUE (numero_toma),
  CONSTRAINT tomas_fisicas_estado_check CHECK (estado IN ('borrador', 'aplicada', 'cancelada')),
  CONSTRAINT tomas_fisicas_aplicada_check CHECK ((estado = 'aplicada') = (fecha_aplicacion IS NOT NULL))
);

-- Una sola toma en borrador a la vez: dos conteos simultáneos se pisarían.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tomas_fisicas_un_borrador
  ON tomas_fisicas ((estado))
  WHERE estado = 'borrador' AND eliminado IS NULL;

CREATE TABLE IF NOT EXISTS tomas_fisicas_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toma_id UUID NOT NULL REFERENCES tomas_fisicas(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  -- Foto al crear la toma. cantidad_sistema es el FÍSICO (disponible +
  -- pendiente por entregar) porque eso es lo que se cuenta en la bodega.
  cantidad_sistema NUMERIC(12,2) NOT NULL,
  costo_unitario NUMERIC(12,2),
  precio_venta NUMERIC(12,2) NOT NULL,
  -- NULL = producto no contado: la toma no lo modifica.
  cantidad_contada NUMERIC(12,2),
  -- Delta realmente aplicado al stock; solo se llena al aplicar la toma.
  diferencia NUMERIC(12,2),
  creado TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tomas_fisicas_detalle_unico UNIQUE (toma_id, producto_id),
  CONSTRAINT tomas_fisicas_detalle_contada_check CHECK (cantidad_contada IS NULL OR cantidad_contada >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tomas_fisicas_detalle_toma ON tomas_fisicas_detalle(toma_id);
CREATE INDEX IF NOT EXISTS idx_tomas_fisicas_aplicacion ON tomas_fisicas(fecha_aplicacion)
  WHERE estado = 'aplicada';

REVOKE ALL ON tomas_fisicas, tomas_fisicas_detalle FROM anon;

DROP TRIGGER IF EXISTS audit_tomas_fisicas ON tomas_fisicas;
CREATE TRIGGER audit_tomas_fisicas
  AFTER INSERT OR UPDATE ON tomas_fisicas
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ----------------------------------------------------------------------------
-- 2. RLS: solo lectura directa; toda escritura va por los RPC (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
ALTER TABLE tomas_fisicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tomas_fisicas_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tomas_fisicas_select_admin" ON tomas_fisicas
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "tomas_fisicas_detalle_select_admin" ON tomas_fisicas_detalle
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

-- ----------------------------------------------------------------------------
-- 3. RPC: obtener_informe_inventario (rango de fechas)
-- ----------------------------------------------------------------------------
-- Una fila por producto con movimiento o existencia en el rango. Cantidades
-- en unidades; la valoración (costo / venta) la hace el frontend sobre
-- costo_unitario y precio_venta de cada fila.
CREATE OR REPLACE FUNCTION obtener_informe_inventario(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fin TIMESTAMPTZ;
  v_resultado JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para ver este informe.';
  END IF;

  IF p_fecha_desde IS NULL OR p_fecha_hasta IS NULL THEN
    RAISE EXCEPTION 'El rango de fechas es obligatorio.';
  END IF;

  IF p_fecha_hasta < p_fecha_desde THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde.';
  END IF;

  IF p_fecha_hasta - p_fecha_desde > 366 THEN
    RAISE EXCEPTION 'El rango del informe no puede superar un año.';
  END IF;

  IF p_fecha_hasta > (NOW() AT TIME ZONE p_zona_horaria)::date THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser futura.';
  END IF;

  v_inicio := p_fecha_desde::timestamp AT TIME ZONE p_zona_horaria;
  v_fin := (p_fecha_hasta + 1)::timestamp AT TIME ZONE p_zona_horaria;

  WITH pendiente_actual AS (
    SELECT d.producto_id, SUM(d.cantidad) AS cantidad
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado IN ('pendiente', 'despachado')
    GROUP BY d.producto_id
  ),
  compras AS (
    SELECT
      cd.producto_id,
      COALESCE(SUM(cd.cantidad) FILTER (WHERE cc.fecha_compra >= v_inicio AND cc.fecha_compra < v_fin), 0) AS en_rango,
      COALESCE(SUM(cd.cantidad) FILTER (WHERE cc.fecha_compra >= v_fin), 0) AS posteriores
    FROM compras_cabecera cc
    JOIN compras_detalle cd ON cd.compra_id = cc.id
    WHERE cc.eliminado IS NULL
      AND cc.estado = 'registrada'
      AND cc.fecha_compra >= v_inicio
    GROUP BY cd.producto_id
  ),
  entregas AS (
    SELECT
      d.producto_id,
      COALESCE(SUM(d.cantidad) FILTER (WHERE c.fecha_entrega < v_fin), 0) AS en_rango,
      COALESCE(SUM(d.cantidad) FILTER (WHERE c.fecha_entrega >= v_fin), 0) AS posteriores
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado = 'entregado'
      AND c.fecha_entrega >= v_inicio
    GROUP BY d.producto_id
  ),
  ajustes AS (
    SELECT
      td.producto_id,
      COALESCE(SUM(td.diferencia) FILTER (WHERE tf.fecha_aplicacion < v_fin), 0) AS en_rango,
      COALESCE(SUM(td.diferencia) FILTER (WHERE tf.fecha_aplicacion >= v_fin), 0) AS posteriores
    FROM tomas_fisicas tf
    JOIN tomas_fisicas_detalle td ON td.toma_id = tf.id
    WHERE tf.eliminado IS NULL
      AND tf.estado = 'aplicada'
      AND tf.fecha_aplicacion >= v_inicio
      AND td.diferencia IS NOT NULL
    GROUP BY td.producto_id
  ),
  -- Pedidos que al cierre del rango estaban comprometidos y sin entregar:
  -- hoy siguen pendientes/despachados, o se entregaron después del cierre.
  preventa AS (
    SELECT d.producto_id, SUM(d.cantidad) AS cantidad
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.fecha_pedido < v_fin
      AND (
        c.estado IN ('pendiente', 'despachado')
        OR (c.estado = 'entregado' AND c.fecha_entrega >= v_fin)
      )
    GROUP BY d.producto_id
  ),
  calculo AS (
    SELECT
      p.id AS producto_id,
      p.codigo,
      p.nombre,
      p.precio_venta,
      pcost.ultimo_costo AS costo_unitario,
      COALESCE(co.en_rango, 0) AS compras,
      COALESCE(en.en_rango, 0) AS ventas,
      COALESCE(aj.en_rango, 0) AS ajustes,
      COALESCE(pv.cantidad, 0) AS preventa,
      -- físico al cierre del rango
      (p.disponible + COALESCE(pa.cantidad, 0))
        - COALESCE(co.posteriores, 0)
        + COALESCE(en.posteriores, 0)
        - COALESCE(aj.posteriores, 0) AS fisico_final
    FROM productos p
    LEFT JOIN productos_costos pcost ON pcost.producto_id = p.id
    LEFT JOIN pendiente_actual pa ON pa.producto_id = p.id
    LEFT JOIN compras co ON co.producto_id = p.id
    LEFT JOIN entregas en ON en.producto_id = p.id
    LEFT JOIN ajustes aj ON aj.producto_id = p.id
    LEFT JOIN preventa pv ON pv.producto_id = p.id
  ),
  filas AS (
    SELECT
      c.*,
      c.fisico_final - c.compras + c.ventas - c.ajustes AS inicial,
      c.fisico_final - c.preventa AS disponible
    FROM calculo c
    WHERE c.compras <> 0 OR c.ventas <> 0 OR c.ajustes <> 0
       OR c.preventa <> 0 OR c.fisico_final <> 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', f.producto_id,
        'codigo', f.codigo,
        'nombre', f.nombre,
        'inicial', f.inicial,
        'compras', f.compras,
        'ventas', f.ventas,
        'ajustes', f.ajustes,
        'fisico_final', f.fisico_final,
        'preventa', f.preventa,
        'disponible', f.disponible,
        'costo_unitario', f.costo_unitario,
        'precio_venta', f.precio_venta
      )
      ORDER BY f.nombre
    ),
    '[]'::jsonb
  )
  INTO v_resultado
  FROM filas f;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_informe_inventario(DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_informe_inventario(DATE, DATE, TEXT) FROM anon, public;

-- ----------------------------------------------------------------------------
-- 4. RPC: obtener_inventario_actual (bodega hoy)
-- ----------------------------------------------------------------------------
-- venta_pendiente = importe real de las líneas por entregar (respeta el tipo
-- de precio de cada pedido), no cantidad × precio de lista.
CREATE OR REPLACE FUNCTION obtener_inventario_actual()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para ver este informe.';
  END IF;

  WITH pendiente AS (
    SELECT
      d.producto_id,
      SUM(d.cantidad) AS cantidad,
      SUM(d.subtotal_linea) AS venta
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado IN ('pendiente', 'despachado')
    GROUP BY d.producto_id
  ),
  filas AS (
    SELECT
      p.id AS producto_id,
      p.codigo,
      p.nombre,
      p.disponible,
      COALESCE(pe.cantidad, 0) AS pendiente,
      COALESCE(pe.venta, 0) AS venta_pendiente,
      pc.ultimo_costo AS costo_unitario,
      p.precio_venta
    FROM productos p
    LEFT JOIN productos_costos pc ON pc.producto_id = p.id
    LEFT JOIN pendiente pe ON pe.producto_id = p.id
    WHERE p.eliminado IS NULL
      AND (p.disponible <> 0 OR COALESCE(pe.cantidad, 0) <> 0)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', f.producto_id,
        'codigo', f.codigo,
        'nombre', f.nombre,
        'disponible', f.disponible,
        'pendiente', f.pendiente,
        'venta_pendiente', f.venta_pendiente,
        'costo_unitario', f.costo_unitario,
        'precio_venta', f.precio_venta
      )
      ORDER BY f.nombre
    ),
    '[]'::jsonb
  )
  INTO v_resultado
  FROM filas f;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_inventario_actual() TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_inventario_actual() FROM anon, public;

-- ----------------------------------------------------------------------------
-- 5. RPC: crear_toma_fisica
-- ----------------------------------------------------------------------------
-- Congela el físico del sistema de cada producto (disponible + pendiente por
-- entregar) y el costo/precio vigentes, que es contra lo que se compara el
-- conteo.
CREATE OR REPLACE FUNCTION crear_toma_fisica(p_notas TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero TEXT;
  v_toma_id UUID;
  v_productos INTEGER;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para crear tomas físicas.';
  END IF;

  -- Serializa la creación: evita dos borradores simultáneos y números repetidos.
  PERFORM pg_advisory_xact_lock(hashtext('tomas_fisicas'));

  IF EXISTS (
    SELECT 1 FROM tomas_fisicas WHERE estado = 'borrador' AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya hay una toma física en curso. Aplícala o cancélala antes de crear otra.';
  END IF;

  SELECT COALESCE(MAX(numero_toma::INTEGER), 0) + 1
    INTO v_numero
    FROM tomas_fisicas
    WHERE numero_toma ~ '^[0-9]+$';

  INSERT INTO tomas_fisicas (numero_toma, usuario_id, notas)
  VALUES (v_numero, auth.uid(), NULLIF(trim(p_notas), ''))
  RETURNING id INTO v_toma_id;

  INSERT INTO tomas_fisicas_detalle (toma_id, producto_id, cantidad_sistema, costo_unitario, precio_venta)
  SELECT
    v_toma_id,
    p.id,
    p.disponible + COALESCE(pe.cantidad, 0),
    pc.ultimo_costo,
    p.precio_venta
  FROM productos p
  LEFT JOIN productos_costos pc ON pc.producto_id = p.id
  LEFT JOIN (
    SELECT d.producto_id, SUM(d.cantidad) AS cantidad
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado IN ('pendiente', 'despachado')
    GROUP BY d.producto_id
  ) pe ON pe.producto_id = p.id
  WHERE p.eliminado IS NULL;

  GET DIAGNOSTICS v_productos = ROW_COUNT;

  RETURN jsonb_build_object(
    'id', v_toma_id,
    'numero_toma', v_numero,
    'productos', v_productos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_toma_fisica(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_toma_fisica(TEXT) FROM anon, public;

-- ----------------------------------------------------------------------------
-- 6. RPC: guardar_conteo_toma_fisica
-- ----------------------------------------------------------------------------
-- Guarda conteos por lotes (pantalla o Excel). cantidad_contada null borra el
-- conteo de ese producto. Todo el lote se valida antes de escribir.
CREATE OR REPLACE FUNCTION guardar_conteo_toma_fisica(
  p_toma_id UUID,
  p_conteos JSONB -- [{ "producto_id": "...", "cantidad_contada": 12.5 | null }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_toma RECORD;
  v_item JSONB;
  v_cantidad NUMERIC;
  v_guardados INTEGER := 0;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar conteos.';
  END IF;

  IF p_conteos IS NULL OR jsonb_typeof(p_conteos) <> 'array' OR jsonb_array_length(p_conteos) = 0 THEN
    RAISE EXCEPTION 'No se recibió ningún conteo.';
  END IF;

  SELECT id, estado INTO v_toma
    FROM tomas_fisicas
    WHERE id = p_toma_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La toma física no existe.';
  END IF;

  IF v_toma.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede contar en una toma física en curso.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_conteos)
  LOOP
    v_cantidad := NULLIF(v_item->>'cantidad_contada', '')::NUMERIC;

    IF v_cantidad IS NOT NULL AND (v_cantidad < 0 OR v_cantidad > 9999999999) THEN
      RAISE EXCEPTION 'Cantidad contada inválida para el producto %', v_item->>'producto_id';
    END IF;

    UPDATE tomas_fisicas_detalle
      SET cantidad_contada = v_cantidad
      WHERE toma_id = p_toma_id
        AND producto_id = (v_item->>'producto_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no pertenece a esta toma física.', v_item->>'producto_id';
    END IF;

    v_guardados := v_guardados + 1;
  END LOOP;

  UPDATE tomas_fisicas SET actualizado = NOW() WHERE id = p_toma_id;

  RETURN jsonb_build_object('guardados', v_guardados);
END;
$$;

GRANT EXECUTE ON FUNCTION guardar_conteo_toma_fisica(UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION guardar_conteo_toma_fisica(UUID, JSONB) FROM anon, public;

-- ----------------------------------------------------------------------------
-- 7. RPC: aplicar_toma_fisica
-- ----------------------------------------------------------------------------
-- Para cada producto contado aplica delta = contado − foto del sistema sobre
-- `disponible` (los pedidos pendientes no cambian, así que todo el delta va a
-- lo libre). Si el delta dejaría el disponible negativo, el conteo es menor
-- que lo ya comprometido en pedidos: se aborta y no se aplica nada.
CREATE OR REPLACE FUNCTION aplicar_toma_fisica(p_toma_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_toma RECORD;
  v_linea RECORD;
  v_delta NUMERIC(12,2);
  v_nuevo_disponible NUMERIC(12,2);
  v_ajustados INTEGER := 0;
  v_sin_cambio INTEGER := 0;
  v_sin_contar INTEGER;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para aplicar tomas físicas.';
  END IF;

  SELECT id, estado INTO v_toma
    FROM tomas_fisicas
    WHERE id = p_toma_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La toma física no existe.';
  END IF;

  IF v_toma.estado <> 'borrador' THEN
    RAISE EXCEPTION 'La toma física ya fue aplicada o cancelada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tomas_fisicas_detalle
    WHERE toma_id = p_toma_id AND cantidad_contada IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No hay ningún producto contado para aplicar.';
  END IF;

  FOR v_linea IN
    SELECT td.id, td.producto_id, td.cantidad_sistema, td.cantidad_contada, p.nombre
      FROM tomas_fisicas_detalle td
      JOIN productos p ON p.id = td.producto_id
      WHERE td.toma_id = p_toma_id
        AND td.cantidad_contada IS NOT NULL
      ORDER BY td.producto_id
  LOOP
    v_delta := v_linea.cantidad_contada - v_linea.cantidad_sistema;

    IF v_delta <> 0 THEN
      UPDATE productos
        SET disponible = disponible + v_delta,
            actualizado = NOW()
        WHERE id = v_linea.producto_id
        RETURNING disponible INTO v_nuevo_disponible;

      IF v_nuevo_disponible < 0 THEN
        RAISE EXCEPTION 'El conteo de "%" es menor que lo ya comprometido en pedidos pendientes. Revisa el conteo o los pedidos.', v_linea.nombre;
      END IF;

      v_ajustados := v_ajustados + 1;
    ELSE
      v_sin_cambio := v_sin_cambio + 1;
    END IF;

    UPDATE tomas_fisicas_detalle SET diferencia = v_delta WHERE id = v_linea.id;
  END LOOP;

  SELECT COUNT(*) INTO v_sin_contar
    FROM tomas_fisicas_detalle
    WHERE toma_id = p_toma_id AND cantidad_contada IS NULL;

  UPDATE tomas_fisicas
    SET estado = 'aplicada',
        fecha_aplicacion = NOW(),
        aplicada_por = auth.uid(),
        actualizado = NOW()
    WHERE id = p_toma_id;

  RETURN jsonb_build_object(
    'ajustados', v_ajustados,
    'sin_cambio', v_sin_cambio,
    'sin_contar', v_sin_contar
  );
END;
$$;

GRANT EXECUTE ON FUNCTION aplicar_toma_fisica(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION aplicar_toma_fisica(UUID) FROM anon, public;

-- ----------------------------------------------------------------------------
-- 8. RPC: cancelar_toma_fisica
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_toma_fisica(p_toma_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_toma RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar tomas físicas.';
  END IF;

  SELECT id, estado INTO v_toma
    FROM tomas_fisicas
    WHERE id = p_toma_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La toma física no existe.';
  END IF;

  IF v_toma.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede cancelar una toma física en curso.';
  END IF;

  UPDATE tomas_fisicas
    SET estado = 'cancelada', actualizado = NOW()
    WHERE id = p_toma_id;

  RETURN jsonb_build_object('estado', 'cancelada');
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_toma_fisica(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION cancelar_toma_fisica(UUID) FROM anon, public;
