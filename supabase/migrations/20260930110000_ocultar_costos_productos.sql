-- ============================================================================
-- Costo de compra fuera de `productos`: solo soporte/gerencia/despachador
-- ============================================================================
-- `productos_select_operativo` deja leer el catálogo completo a vendedor,
-- repartidor y cajera (lo necesitan para armar pedidos), y con él venía
-- `productos.ultimo_costo`: cualquier vendedor podía sacar costos y márgenes
-- con un `GET /rest/v1/productos?select=ultimo_costo`.
--
-- Opciones evaluadas:
--   * Privilegios por columna (REVOKE SELECT (ultimo_costo)): los privilegios
--     son por rol de Postgres y todos los usuarios de la app son
--     `authenticated`, así que se le quitaría también a gerencia. Además
--     PostgREST expande `select=*` a todas las columnas y la consulta entera
--     falla con "permission denied" — rompe los `select *` existentes.
--   * Exponer el costo solo por RPC: obliga a quitar la columna de la tabla
--     igual, y agrega una RPC por cada pantalla que lo muestra.
--   * Tabla satélite 1:1 con RLS propia (elegida): Postgres no tiene RLS por
--     columna, pero sí por tabla. `productos` sigue sirviendo `select *` a
--     todos sus roles (sin el costo) y el costo se embebe con
--     `productos_costos(ultimo_costo)` solo donde se muestra: a un rol sin
--     acceso el embed le llega en null en vez de fallar.
--
-- Acceso: los mismos 3 roles que ya leen `compras_detalle` (de donde sale
-- este valor), así despachador conserva lo que hoy ve en Compras y en el
-- catálogo. Escritura solo desde las RPC de compras (SECURITY DEFINER).
--
-- Sin `estado`/`eliminado`: es una extensión de `productos`, que ya carga
-- con el soft delete; la fila vive y muere con su producto (ON DELETE
-- CASCADE para el borrado físico que permite productos_write_admin).
-- "Sin costo conocido" = no hay fila (en vez de fila con NULL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla y permisos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos_costos (
  producto_id UUID PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  ultimo_costo NUMERIC(12,2) NOT NULL,
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT productos_costos_ultimo_costo_check CHECK (ultimo_costo >= 0)
);

ALTER TABLE productos_costos ENABLE ROW LEVEL SECURITY;

-- Privilegio mínimo: RLS no cubre TRUNCATE, así que no basta con omitir
-- políticas de escritura.
REVOKE ALL ON TABLE productos_costos FROM anon, authenticated;
GRANT SELECT ON TABLE productos_costos TO authenticated;

CREATE POLICY "productos_costos_select_compras" ON productos_costos
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

DROP TRIGGER IF EXISTS set_timestamp_productos_costos ON productos_costos;
CREATE TRIGGER set_timestamp_productos_costos
  BEFORE UPDATE ON productos_costos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ----------------------------------------------------------------------------
-- 2. Mover los costos existentes y quitar la columna expuesta
-- ----------------------------------------------------------------------------
INSERT INTO productos_costos (producto_id, ultimo_costo)
SELECT id, ultimo_costo
FROM productos
WHERE ultimo_costo IS NOT NULL
ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;

ALTER TABLE productos DROP COLUMN IF EXISTS ultimo_costo;

-- ----------------------------------------------------------------------------
-- 3. crear_compra_transaccional: el último costo va a productos_costos
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20260921120000_pagos_en_compras.sql; solo cambia dónde se
-- guarda el último costo. CREATE OR REPLACE conserva los GRANT/REVOKE.
CREATE OR REPLACE FUNCTION crear_compra_transaccional(
  p_proveedor_id UUID,
  p_notas TEXT,
  p_detalles JSONB, -- [{ "producto_id": "...", "cantidad": 10, "costo_unitario": 1500 }, ...]
  p_fecha_compra TIMESTAMPTZ DEFAULT NULL,
  p_pagos JSONB DEFAULT NULL -- [{ "metodo_pago_id": "...", "monto": 1000 }, ...]
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
  v_fecha_compra TIMESTAMPTZ;
  v_detalles_insertar JSONB := '[]'::JSONB;
  v_config RECORD;
  v_hay_pagos BOOLEAN := p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0;
  v_pagado NUMERIC := 0;
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

  v_fecha_compra := COALESCE(p_fecha_compra, NOW());
  IF v_fecha_compra > NOW() THEN
    RAISE EXCEPTION 'La fecha de la compra no puede ser futura.';
  END IF;

  SELECT metodos_pago_activo, abonos_compras_activo INTO v_config FROM configuracion_sistema;

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
          actualizado = NOW()
      WHERE id = v_producto.id;

    INSERT INTO productos_costos (producto_id, ultimo_costo)
    VALUES (v_producto.id, v_costo_unitario)
    ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
  END LOOP;

  SELECT COALESCE(MAX(numero_compra::INTEGER), 0) + 1
    INTO v_numero_compra
    FROM compras_cabecera
    WHERE numero_compra ~ '^[0-9]+$';

  IF v_numero_compra IS NULL THEN
    v_numero_compra := '1';
  END IF;

  INSERT INTO compras_cabecera (numero_compra, proveedor_id, usuario_id, notas, total, fecha_compra)
  VALUES (v_numero_compra, p_proveedor_id, auth.uid(), p_notas, v_total, v_fecha_compra)
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

  IF v_total > 0 THEN
    IF v_config.abonos_compras_activo THEN
      -- Pago inicial opcional y parcial: el resto queda como saldo al proveedor.
      IF v_hay_pagos THEN
        v_pagado := registrar_pagos(NULL, v_compra_id, 'pago', p_pagos);
        IF v_pagado > v_total THEN
          RAISE EXCEPTION 'El pago (%) supera el total de la compra (%).', v_pagado, v_total;
        END IF;
      END IF;
    ELSE
      -- Sin abonos, la compra se paga completa al registrarla.
      IF NOT v_hay_pagos THEN
        IF v_config.metodos_pago_activo THEN
          RAISE EXCEPTION 'Debe registrar el pago de la compra (%).', v_total;
        END IF;
        p_pagos := jsonb_build_array(jsonb_build_object('monto', v_total));
      END IF;

      v_pagado := registrar_pagos(NULL, v_compra_id, 'pago', p_pagos);
      IF v_pagado <> v_total THEN
        RAISE EXCEPTION 'El pago debe cubrir exactamente el total de la compra (%). Se recibió %.', v_total, v_pagado;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_compra_id,
    'numero_compra', v_numero_compra,
    'total', v_total,
    'saldo', v_total - v_pagado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. anular_compra_transaccional: recalcula el costo en productos_costos
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20260921120000_pagos_en_compras.sql. Si no queda ninguna
-- compra registrada del producto, se borra su fila (= costo desconocido).
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

  SELECT id, estado, total_pagado INTO v_compra
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

    SELECT cd.costo_unitario INTO v_ultimo_costo
      FROM compras_detalle cd
      JOIN compras_cabecera cc ON cc.id = cd.compra_id
      WHERE cd.producto_id = v_detalle.producto_id
        AND cc.estado = 'registrada'
        AND cc.id <> p_compra_id
      ORDER BY cc.fecha_compra DESC, cc.creado DESC
      LIMIT 1;

    IF v_ultimo_costo IS NULL THEN
      DELETE FROM productos_costos WHERE producto_id = v_detalle.producto_id;
    ELSE
      INSERT INTO productos_costos (producto_id, ultimo_costo)
      VALUES (v_detalle.producto_id, v_ultimo_costo)
      ON CONFLICT (producto_id) DO UPDATE SET ultimo_costo = EXCLUDED.ultimo_costo;
    END IF;
  END LOOP;

  UPDATE compras_cabecera
    SET estado = 'anulada',
        notas = p_motivo,
        actualizado = NOW()
    WHERE id = p_compra_id;

  PERFORM devolver_pagos(NULL, p_compra_id, v_compra.total_pagado);

  RETURN jsonb_build_object(
    'id', p_compra_id,
    'estado', 'anulada',
    'devuelto', v_compra.total_pagado
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
