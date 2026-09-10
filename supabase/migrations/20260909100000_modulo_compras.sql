-- ============================================================================
-- Módulo de Compras: alimenta el inventario con trazabilidad de proveedor
-- y costo de compra
-- ============================================================================
-- Hasta ahora la única forma de subir `productos.disponible` era la carga
-- masiva de Excel (`importar_productos_excel`), pensada para sincronizar
-- con el ERP contable, no para registrar compras puntuales a proveedores.
-- Esta migración agrega:
--   1. `proveedores`: catálogo propio (mismo nivel que `clientes`, sin la
--      distinción natural/jurídica que es específica de facturación
--      electrónica a clientes).
--   2. `productos.ultimo_costo`: último costo de compra conocido, para ver
--      cuándo un producto sube o baja de precio de costo. El historial
--      completo se consulta directamente desde `compras_detalle` (no hace
--      falta una tabla de historial aparte).
--   3. `compras_cabecera` / `compras_detalle`: mismo patrón que
--      `pedidos_cabecera` / `pedidos_detalle` (cabecera + detalle, soft
--      delete, `estado` con transición única `registrada -> anulada`).
--   4. RPCs transaccionales `crear_compra_transaccional` /
--      `anular_compra_transaccional`, calcadas de
--      `crear_pedido_transaccional` / `anular_pedido_transaccional`.
--
-- Roles con acceso: soporte, gerencia, despachador (acordado con el
-- usuario; sin rol nuevo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROVEEDORES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_identificacion VARCHAR(50) NOT NULL,
  nombre_comercial VARCHAR(255) NOT NULL,
  contacto_nombre VARCHAR(150),
  telefono VARCHAR(50),
  correo VARCHAR(150),
  direccion TEXT,
  estado BOOLEAN DEFAULT true,
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ DEFAULT now(),
  eliminado TIMESTAMPTZ,
  CONSTRAINT proveedores_numero_identificacion_key UNIQUE (numero_identificacion)
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select_operativo" ON proveedores
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

CREATE POLICY "proveedores_insert_compras" ON proveedores
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

CREATE POLICY "proveedores_update_compras" ON proveedores
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

-- Sin política de DELETE: baja lógica vía UPDATE de `eliminado`, igual que
-- clientes/productos.

-- ----------------------------------------------------------------------------
-- 2. PRODUCTOS: último costo de compra conocido
-- ----------------------------------------------------------------------------
ALTER TABLE productos ADD COLUMN IF NOT EXISTS ultimo_costo NUMERIC(12,2);

-- ----------------------------------------------------------------------------
-- 3. COMPRAS (cabecera y detalle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras_cabecera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_compra VARCHAR(50) NOT NULL,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  usuario_id UUID NOT NULL REFERENCES perfiles(id),
  fecha_compra TIMESTAMPTZ DEFAULT now(),
  estado VARCHAR(20) DEFAULT 'registrada' NOT NULL,
  total NUMERIC(12,2) DEFAULT 0 NOT NULL,
  notas TEXT,
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ,
  eliminado TIMESTAMPTZ,
  CONSTRAINT compras_cabecera_estado_check CHECK (estado IN ('registrada', 'anulada'))
);

CREATE TABLE IF NOT EXISTS compras_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES compras_cabecera(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,2) NOT NULL,
  costo_unitario NUMERIC(12,2) NOT NULL,
  subtotal_linea NUMERIC(12,2) NOT NULL,
  creado TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT compras_detalle_cantidad_check CHECK (cantidad > 0),
  CONSTRAINT compras_detalle_costo_check CHECK (costo_unitario >= 0)
);

ALTER TABLE compras_cabecera ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_cabecera_select_operativo" ON compras_cabecera
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

CREATE POLICY "compras_detalle_select_operativo" ON compras_detalle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compras_cabecera cc
      WHERE cc.id = compras_detalle.compra_id
        AND obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    )
  );

-- Sin políticas de INSERT/UPDATE en ninguna de las dos tablas: el alta
-- ocurre exclusivamente dentro de crear_compra_transaccional y la
-- anulación dentro de anular_compra_transaccional (ambas SECURITY
-- DEFINER). No se abre otra vía, mismo criterio que pedidos_detalle /
-- despachos_pedidos.

-- ----------------------------------------------------------------------------
-- 4. RPC: crear_compra_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_compra_transaccional(
  p_proveedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB -- [{ "producto_id": "...", "cantidad": 10, "costo_unitario": 1500 }, ...]
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
  v_costo_unitario NUMERIC(12,2);
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_compra TEXT;
  v_compra_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar compras.';
  END IF;

  IF p_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un proveedor.';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La compra debe contener al menos un producto.';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_costo_unitario := (v_item->>'costo_unitario')::NUMERIC;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    IF v_costo_unitario IS NULL OR v_costo_unitario < 0 THEN
      RAISE EXCEPTION 'Costo unitario inválido para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    v_subtotal_linea := v_costo_unitario * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'costo_unitario', v_costo_unitario,
      'subtotal_linea', v_subtotal_linea
    );

    UPDATE productos
      SET disponible = disponible + v_cantidad,
          ultimo_costo = v_costo_unitario,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  SELECT COALESCE(MAX(numero_compra::INTEGER), 0) + 1
    INTO v_numero_compra
    FROM compras_cabecera
    WHERE numero_compra ~ '^[0-9]+$';

  IF v_numero_compra IS NULL THEN
    v_numero_compra := '1';
  END IF;

  INSERT INTO compras_cabecera (numero_compra, proveedor_id, usuario_id, notas, total)
  VALUES (v_numero_compra, p_proveedor_id, auth.uid(), p_notas, v_total)
  RETURNING id INTO v_compra_id;

  INSERT INTO compras_detalle (
    compra_id, producto_id, cantidad, costo_unitario, subtotal_linea
  )
  SELECT
    v_compra_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::NUMERIC,
    (d->>'costo_unitario')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_compra_id,
    'numero_compra', v_numero_compra,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION crear_compra_transaccional(UUID, TEXT, JSONB) FROM anon;

-- ----------------------------------------------------------------------------
-- 5. RPC: anular_compra_transaccional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_compra_transaccional(
  p_compra_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_detalle RECORD;
  v_ultimo_costo NUMERIC;
BEGIN
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe indicar un motivo para anular la compra.';
  END IF;

  IF obtener_rol_actual() NOT IN ('soporte', 'gerencia', 'despachador') THEN
    RAISE EXCEPTION 'No tienes permiso para anular compras.';
  END IF;

  SELECT id, estado INTO v_compra
    FROM compras_cabecera
    WHERE id = p_compra_id
      AND eliminado IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe o fue eliminada.';
  END IF;

  IF v_compra.estado = 'anulada' THEN
    RAISE EXCEPTION 'La compra ya está anulada.';
  END IF;

  FOR v_detalle IN
    SELECT producto_id, cantidad
      FROM compras_detalle
      WHERE compra_id = p_compra_id
      ORDER BY producto_id
  LOOP
    UPDATE productos
      SET disponible = disponible - v_detalle.cantidad,
          actualizado = NOW()
      WHERE id = v_detalle.producto_id;

    -- Recalcula el último costo desde cero (mismo criterio que
    -- importar_productos_excel: recomputar en vez de ajustar
    -- incrementalmente) buscando la compra 'registrada' más reciente que
    -- quede para ese producto, excluyendo la que se está anulando.
    SELECT cd.costo_unitario INTO v_ultimo_costo
      FROM compras_detalle cd
      JOIN compras_cabecera cc ON cc.id = cd.compra_id
      WHERE cd.producto_id = v_detalle.producto_id
        AND cc.estado = 'registrada'
        AND cc.id <> p_compra_id
      ORDER BY cc.fecha_compra DESC, cc.creado DESC
      LIMIT 1;

    UPDATE productos
      SET ultimo_costo = v_ultimo_costo
      WHERE id = v_detalle.producto_id;
  END LOOP;

  UPDATE compras_cabecera
    SET estado = 'anulada',
        notas = p_motivo,
        actualizado = NOW()
    WHERE id = p_compra_id;

  RETURN jsonb_build_object('id', p_compra_id, 'estado', 'anulada');
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION anular_compra_transaccional(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION anular_compra_transaccional(UUID, TEXT) FROM anon;
