-- ============================================================================
-- Costo por línea de pedido fuera de `pedidos_detalle`: solo soporte/gerencia
-- ============================================================================
-- 20260930100000_informe_utilidad.sql agregó `pedidos_detalle.costo_unitario`,
-- y `pedidos_detalle_select_operativo` deja a vendedor/cajera leer las líneas
-- de sus propios pedidos (y a repartidor las de sus despachos): con
-- `select=costo_unitario` sacaban el costo y el margen de cada venta.
--
-- Mismo criterio que 20260930110000_ocultar_costos_productos.sql (ver ahí las
-- opciones descartadas): tabla satélite 1:1 con RLS propia. `pedidos_detalle`
-- sigue sirviendo `select *` a todos sus roles, ahora sin el costo.
--
-- Acceso: soporte/gerencia, los únicos que ven el informe de utilidad (su
-- RPC es SECURITY DEFINER y no depende de esta política). Despachador no lo
-- necesita: el costo de compra lo sigue viendo en productos_costos.
--
-- IMPORTANTE: aplicar junto con 20260930110000 (esa migración quita
-- `productos.ultimo_costo`, que el trigger anterior de esta tabla leía; entre
-- una y otra, crear pedidos falla).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla y permisos
-- ----------------------------------------------------------------------------
-- Sin `estado`/`eliminado`/`actualizado`: la fila es inmutable (foto del
-- costo al registrar la línea) y vive y muere con su línea; editar un pedido
-- borra y reinserta sus líneas, y el ON DELETE CASCADE se lleva el costo.
-- "Sin costo conocido" = no hay fila.
CREATE TABLE IF NOT EXISTS pedidos_detalle_costos (
  pedido_detalle_id UUID PRIMARY KEY REFERENCES pedidos_detalle(id) ON DELETE CASCADE,
  costo_unitario NUMERIC(12,2) NOT NULL,
  creado TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pedidos_detalle_costos_costo_check CHECK (costo_unitario >= 0)
);

ALTER TABLE pedidos_detalle_costos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pedidos_detalle_costos FROM anon, authenticated;
GRANT SELECT ON TABLE pedidos_detalle_costos TO authenticated;

CREATE POLICY "pedidos_detalle_costos_select_admin" ON pedidos_detalle_costos
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'));

-- ----------------------------------------------------------------------------
-- 2. Mover los costos ya capturados
-- ----------------------------------------------------------------------------
INSERT INTO pedidos_detalle_costos (pedido_detalle_id, costo_unitario)
SELECT id, costo_unitario
FROM pedidos_detalle
WHERE costo_unitario IS NOT NULL
ON CONFLICT (pedido_detalle_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Trigger: captura el costo vigente en la tabla satélite
-- ----------------------------------------------------------------------------
-- Pasa de BEFORE a AFTER INSERT porque necesita el id ya asignado de la
-- línea. Sigue siendo el servidor quien decide el costo, nunca quien llama.
CREATE OR REPLACE FUNCTION asignar_costo_pedido_detalle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO pedidos_detalle_costos (pedido_detalle_id, costo_unitario)
  SELECT NEW.id, pc.ultimo_costo
  FROM productos_costos pc
  WHERE pc.producto_id = NEW.producto_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION asignar_costo_pedido_detalle() FROM anon, public;

DROP TRIGGER IF EXISTS trg_asignar_costo_pedido_detalle ON pedidos_detalle;
CREATE TRIGGER trg_asignar_costo_pedido_detalle
  AFTER INSERT ON pedidos_detalle
  FOR EACH ROW EXECUTE FUNCTION asignar_costo_pedido_detalle();

-- ----------------------------------------------------------------------------
-- 4. obtener_informe_utilidad: lee el costo de la tabla satélite
-- ----------------------------------------------------------------------------
-- Mismo cuerpo que 20260930100000_informe_utilidad.sql; solo cambia el
-- origen del costo en el CTE `lineas` (LEFT JOIN: sin fila = sin costo).
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
      dc.costo_unitario * d.cantidad AS costo
    FROM pedidos_cabecera c
    JOIN pedidos_detalle d ON d.pedido_id = c.id
    LEFT JOIN pedidos_detalle_costos dc ON dc.pedido_detalle_id = d.id
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

-- ----------------------------------------------------------------------------
-- 5. Quitar la columna expuesta
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_detalle DROP COLUMN IF EXISTS costo_unitario;
