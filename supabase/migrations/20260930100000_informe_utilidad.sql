-- ============================================================================
-- Informe de utilidad bruta: ventas − costo de lo vendido (soporte/gerencia)
-- ============================================================================
-- Hasta ahora un pedido guardaba solo el precio de venta de cada línea; el
-- costo vivía únicamente en `productos.ultimo_costo`, que cambia con cada
-- compra. Calcular la utilidad de un mes con el costo de HOY daría un
-- número distinto cada vez que se consulta, así que:
--
--   1. `pedidos_detalle.costo_unitario`: foto del costo del producto en el
--      momento en que se registra la línea. NULL = el producto no tenía
--      costo conocido (nunca se compró por el módulo de compras).
--
--   2. Trigger BEFORE INSERT que la llena desde `productos.ultimo_costo`.
--      Va por trigger y no dentro de cada RPC porque las líneas se insertan
--      desde varios (crear, editar, venta directa de cajera) y así ninguno
--      puede olvidarlo. Siempre sobrescribe lo que venga: el costo lo decide
--      el servidor, no quien llama. Editar un pedido borra y reinserta sus
--      líneas, así que el costo se re-captura al momento de la edición.
--
--   3. Backfill de las líneas existentes con el costo de la última compra
--      registrada ANTES de la fecha del pedido (lo más cercano al costo real
--      de ese momento); si no hubo compra previa, se usa el último costo
--      conocido del producto. Lo que quede NULL se reporta como "ventas sin
--      costo" en vez de asumir costo cero e inflar la utilidad.
--
--   4. RPC obtener_informe_utilidad: mismo criterio de venta que
--      obtener_informe_ventas (pedidos 'entregado' por fecha_entrega, días
--      cortados en la zona horaria del negocio) y mismo guard de rol.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columna de costo en el detalle del pedido
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_detalle ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2);

-- ----------------------------------------------------------------------------
-- 2. Trigger: captura el costo vigente al insertar la línea
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asignar_costo_pedido_detalle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT p.ultimo_costo INTO NEW.costo_unitario
  FROM productos p
  WHERE p.id = NEW.producto_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION asignar_costo_pedido_detalle() FROM anon, public;

DROP TRIGGER IF EXISTS trg_asignar_costo_pedido_detalle ON pedidos_detalle;
CREATE TRIGGER trg_asignar_costo_pedido_detalle
  BEFORE INSERT ON pedidos_detalle
  FOR EACH ROW EXECUTE FUNCTION asignar_costo_pedido_detalle();

-- ----------------------------------------------------------------------------
-- 3. Backfill de líneas existentes
-- ----------------------------------------------------------------------------
UPDATE pedidos_detalle d
SET costo_unitario = COALESCE(
  (
    SELECT cd.costo_unitario
    FROM compras_detalle cd
    JOIN compras_cabecera cc ON cc.id = cd.compra_id
    WHERE cd.producto_id = d.producto_id
      AND cc.estado = 'registrada'
      AND cc.eliminado IS NULL
      AND cc.fecha_compra <= pc.fecha_pedido
    ORDER BY cc.fecha_compra DESC, cc.creado DESC
    LIMIT 1
  ),
  pr.ultimo_costo
)
FROM pedidos_cabecera pc, productos pr
WHERE pc.id = d.pedido_id
  AND pr.id = d.producto_id
  AND d.costo_unitario IS NULL;

-- ----------------------------------------------------------------------------
-- 4. RPC: obtener_informe_utilidad
-- ----------------------------------------------------------------------------
-- Devuelve:
--   resumen: ventas (todas las entregadas), ventas_con_costo, costo,
--            utilidad (= ventas_con_costo − costo), pedidos y el bloque
--            sin_costo { monto, productos } para advertir qué quedó fuera.
--   detalle: una fila por producto, ordenada por utilidad descendente.
-- El margen (utilidad / ventas_con_costo) lo calcula el frontend: es una
-- división de presentación, no una regla de negocio.
CREATE OR REPLACE FUNCTION obtener_informe_utilidad(
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

  v_inicio := p_fecha_desde::timestamp AT TIME ZONE p_zona_horaria;
  v_fin := (p_fecha_hasta + 1)::timestamp AT TIME ZONE p_zona_horaria;

  WITH lineas AS (
    SELECT
      d.pedido_id,
      d.producto_id,
      d.cantidad,
      d.subtotal_linea AS venta,
      d.costo_unitario * d.cantidad AS costo
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    WHERE c.eliminado IS NULL
      AND c.estado = 'entregado'
      AND c.fecha_entrega >= v_inicio
      AND c.fecha_entrega < v_fin
  ),
  por_producto AS (
    SELECT
      l.producto_id,
      SUM(l.cantidad) AS cantidad,
      SUM(l.venta) AS ventas,
      COALESCE(SUM(l.venta) FILTER (WHERE l.costo IS NOT NULL), 0) AS ventas_con_costo,
      COALESCE(SUM(l.costo), 0) AS costo,
      COALESCE(SUM(l.venta) FILTER (WHERE l.costo IS NULL), 0) AS ventas_sin_costo,
      COUNT(DISTINCT l.pedido_id) AS pedidos
    FROM lineas l
    GROUP BY l.producto_id
  )
  SELECT jsonb_build_object(
    'resumen', jsonb_build_object(
      'ventas', COALESCE((SELECT SUM(ventas) FROM por_producto), 0),
      'ventas_con_costo', COALESCE((SELECT SUM(ventas_con_costo) FROM por_producto), 0),
      'costo', COALESCE((SELECT SUM(costo) FROM por_producto), 0),
      'utilidad', COALESCE((SELECT SUM(ventas_con_costo - costo) FROM por_producto), 0),
      'pedidos', (SELECT COUNT(DISTINCT pedido_id) FROM lineas),
      'sin_costo', jsonb_build_object(
        'monto', COALESCE((SELECT SUM(ventas_sin_costo) FROM por_producto), 0),
        'productos', (SELECT COUNT(*) FROM por_producto WHERE ventas_sin_costo > 0)
      )
    ),
    'detalle', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'producto_id', pp.producto_id,
            'codigo', pr.codigo,
            'nombre', pr.nombre,
            'cantidad', pp.cantidad,
            'ventas', pp.ventas,
            'ventas_con_costo', pp.ventas_con_costo,
            'costo', pp.costo,
            'utilidad', pp.ventas_con_costo - pp.costo,
            'ventas_sin_costo', pp.ventas_sin_costo,
            'pedidos', pp.pedidos
          )
          ORDER BY pp.ventas_con_costo - pp.costo DESC, pr.nombre
        )
        FROM por_producto pp
        JOIN productos pr ON pr.id = pp.producto_id
      ),
      '[]'::jsonb
    )
  )
  INTO v_resultado;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_informe_utilidad(DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION obtener_informe_utilidad(DATE, DATE, TEXT) FROM anon, public;
