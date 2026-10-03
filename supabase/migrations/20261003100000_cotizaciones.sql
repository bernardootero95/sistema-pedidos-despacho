-- ============================================================================
-- Módulo de Cotizaciones (soporte y gerencia)
-- ============================================================================
-- Una cotización es una oferta de precios a un cliente, con vigencia, que NO
-- toca el inventario. Se puede imprimir y, si el cliente acepta, convertir en
-- un pedido.
--
--   1. cotizaciones_cabecera / cotizaciones_detalle: mismo patrón que
--      pedidos_* (cabecera + detalle, soft delete, estado con CHECK).
--      Estados guardados: vigente -> convertida | anulada. "Vencida" no se
--      guarda: se deriva de fecha_vencimiento (sin jobs que mantener).
--   2. crear_cotizacion_transaccional: precios resueltos en el servidor con
--      resolver_precio_pedido (mismas reglas de normal/mayorista/personalizado
--      que un pedido), sin validar stock.
--   3. anular_cotizacion_transaccional.
--   4. convertir_cotizacion_en_pedido: crea el pedido reutilizando
--      crear_pedido_transaccional (stock, precios vigentes y reglas de rol) y
--      marca la cotización como convertida, todo en una sola transacción.
--
-- Roles con acceso: soporte y gerencia (ampliable luego sin migrar datos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones_cabecera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cotizacion VARCHAR(50) NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  usuario_id UUID NOT NULL REFERENCES perfiles(id),
  fecha_cotizacion TIMESTAMPTZ DEFAULT now() NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'vigente' NOT NULL,
  total NUMERIC(12,2) DEFAULT 0 NOT NULL,
  notas TEXT,
  pedido_id UUID REFERENCES pedidos_cabecera(id),
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ,
  eliminado TIMESTAMPTZ,
  CONSTRAINT cotizaciones_cabecera_numero_key UNIQUE (numero_cotizacion),
  CONSTRAINT cotizaciones_cabecera_estado_check CHECK (estado IN ('vigente', 'convertida', 'anulada')),
  CONSTRAINT cotizaciones_cabecera_convertida_check CHECK ((estado = 'convertida') = (pedido_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones_cabecera(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  iva_porcentaje NUMERIC(5,2) DEFAULT 0 NOT NULL,
  inc_porcentaje NUMERIC(5,2) DEFAULT 0 NOT NULL,
  subtotal_linea NUMERIC(12,2) NOT NULL,
  tipo_precio VARCHAR(20) DEFAULT 'normal' NOT NULL,
  tipo_precio_id UUID REFERENCES tipos_precio(id),
  creado TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cotizaciones_detalle_cantidad_check CHECK (cantidad > 0),
  CONSTRAINT cotizaciones_detalle_precio_check CHECK (precio_unitario >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cabecera_cliente ON cotizaciones_cabecera(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cabecera_fecha ON cotizaciones_cabecera(fecha_cotizacion DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_detalle_cotizacion ON cotizaciones_detalle(cotizacion_id);

REVOKE ALL ON cotizaciones_cabecera, cotizaciones_detalle FROM anon;

-- Historial de cambios con el trigger genérico ya usado en pedidos_cabecera.
DROP TRIGGER IF EXISTS audit_cotizaciones_cabecera ON cotizaciones_cabecera;
CREATE TRIGGER audit_cotizaciones_cabecera
  AFTER INSERT OR UPDATE ON cotizaciones_cabecera
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ----------------------------------------------------------------------------
-- 2. RLS: solo lectura directa; toda escritura va por los RPC (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
ALTER TABLE cotizaciones_cabecera ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotizaciones_cabecera_select_admin" ON cotizaciones_cabecera
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "cotizaciones_detalle_select_admin" ON cotizaciones_detalle
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

-- ----------------------------------------------------------------------------
-- 3. RPC: crear_cotizacion_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_cotizacion_transaccional(
  p_cliente_id UUID,
  p_fecha_vencimiento DATE,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id", "cantidad", "tipo_precio", "tipo_precio_id" }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_producto RECORD;
  v_cantidad NUMERIC(12,2);
  v_tipo_precio TEXT;
  v_tipo_precio_id UUID;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Bogota')::date;
  v_numero TEXT;
  v_cotizacion_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para crear cotizaciones.';
  END IF;

  IF p_cliente_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = p_cliente_id AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'Debe seleccionar un cliente válido.';
  END IF;

  IF p_fecha_vencimiento IS NULL OR p_fecha_vencimiento < v_hoy THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a hoy.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La cotización debe contener al menos un producto.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_tipo_precio := COALESCE(v_item->>'tipo_precio', 'normal');
    v_tipo_precio_id := CASE
      WHEN v_tipo_precio = 'personalizado' THEN NULLIF(v_item->>'tipo_precio_id', '')::UUID
      ELSE NULL
    END;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    -- Mismo límite que un pedido, para que la cotización siempre se pueda convertir.
    IF MOD((v_cantidad * 100)::INTEGER, 25) <> 0 THEN
      RAISE EXCEPTION 'La cantidad del producto % debe ser un número entero o con fracción .25, .5 o .75.', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    v_precio := resolver_precio_pedido(
      v_producto.id, v_producto.nombre, v_producto.precio_venta,
      v_cantidad, v_tipo_precio, v_tipo_precio_id
    );
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea,
      'tipo_precio', v_tipo_precio,
      'tipo_precio_id', v_tipo_precio_id
    );
  END LOOP;

  -- Serializa la numeración: dos cotizaciones simultáneas no pueden tomar el
  -- mismo número (además de la restricción UNIQUE como red de seguridad).
  PERFORM pg_advisory_xact_lock(hashtext('cotizaciones_numero'));

  SELECT (COALESCE(MAX(numero_cotizacion::INTEGER), 0) + 1)::TEXT
    INTO v_numero
    FROM cotizaciones_cabecera
    WHERE numero_cotizacion ~ '^[0-9]+$';

  INSERT INTO cotizaciones_cabecera (
    numero_cotizacion, cliente_id, usuario_id, fecha_vencimiento, notas, total
  )
  VALUES (v_numero, p_cliente_id, auth.uid(), p_fecha_vencimiento, NULLIF(trim(p_notas), ''), v_total)
  RETURNING id INTO v_cotizacion_id;

  INSERT INTO cotizaciones_detalle (
    cotizacion_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea, tipo_precio, tipo_precio_id
  )
  SELECT
    v_cotizacion_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC,
    d->>'tipo_precio',
    NULLIF(d->>'tipo_precio_id', '')::UUID
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_cotizacion_id,
    'numero_cotizacion', v_numero,
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION crear_cotizacion_transaccional(UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_cotizacion_transaccional(UUID, DATE, TEXT, JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: anular_cotizacion_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_cotizacion_transaccional(
  p_cotizacion_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion RECORD;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para anular cotizaciones.';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular la cotización.';
  END IF;

  SELECT id, estado INTO v_cotizacion
    FROM cotizaciones_cabecera
    WHERE id = p_cotizacion_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no existe o fue eliminada.';
  END IF;

  IF v_cotizacion.estado = 'anulada' THEN
    RAISE EXCEPTION 'La cotización ya está anulada.';
  END IF;

  IF v_cotizacion.estado = 'convertida' THEN
    RAISE EXCEPTION 'La cotización ya se convirtió en pedido; anula el pedido en su lugar.';
  END IF;

  UPDATE cotizaciones_cabecera
    SET estado = 'anulada',
        notas = trim(p_motivo),
        actualizado = NOW()
    WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object('id', p_cotizacion_id, 'estado', 'anulada');
END;
$$;

REVOKE EXECUTE ON FUNCTION anular_cotizacion_transaccional(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION anular_cotizacion_transaccional(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC: convertir_cotizacion_en_pedido
-- ----------------------------------------------------------------------------
-- El pedido se crea con crear_pedido_transaccional, así que valida stock y
-- resuelve los precios VIGENTES del catálogo (igual que cualquier pedido): si
-- cambiaron desde que se cotizó, el total del pedido puede diferir del de la
-- cotización. Devuelve ambos totales para que la pantalla lo informe.
CREATE OR REPLACE FUNCTION convertir_cotizacion_en_pedido(p_cotizacion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion RECORD;
  v_detalles JSONB;
  v_pedido JSONB;
  v_pedido_id UUID;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia') THEN
    RAISE EXCEPTION 'No tienes permiso para convertir cotizaciones en pedidos.';
  END IF;

  SELECT id, cliente_id, estado, fecha_vencimiento, total, numero_cotizacion
    INTO v_cotizacion
    FROM cotizaciones_cabecera
    WHERE id = p_cotizacion_id AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no existe o fue eliminada.';
  END IF;

  IF v_cotizacion.estado = 'convertida' THEN
    RAISE EXCEPTION 'La cotización ya fue convertida en pedido.';
  END IF;

  IF v_cotizacion.estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede convertir una cotización anulada.';
  END IF;

  IF v_cotizacion.fecha_vencimiento < (NOW() AT TIME ZONE 'America/Bogota')::date THEN
    RAISE EXCEPTION 'La cotización está vencida; crea una nueva cotización.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'producto_id', producto_id,
           'cantidad', cantidad,
           'tipo_precio', tipo_precio,
           'tipo_precio_id', tipo_precio_id
         ) ORDER BY creado)
    INTO v_detalles
    FROM cotizaciones_detalle
    WHERE cotizacion_id = p_cotizacion_id;

  v_pedido := crear_pedido_transaccional(
    v_cotizacion.cliente_id,
    auth.uid(),
    'Generado desde la cotización N° ' || v_cotizacion.numero_cotizacion,
    v_detalles
  );
  v_pedido_id := (v_pedido->>'id')::UUID;

  UPDATE cotizaciones_cabecera
    SET estado = 'convertida',
        pedido_id = v_pedido_id,
        actualizado = NOW()
    WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'numero_pedido', v_pedido->>'numero_pedido',
    'total_pedido', (v_pedido->>'total')::NUMERIC,
    'total_cotizado', v_cotizacion.total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION convertir_cotizacion_en_pedido(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION convertir_cotizacion_en_pedido(UUID) TO authenticated;
