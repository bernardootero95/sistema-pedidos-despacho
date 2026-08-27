-- ============================================================================
-- HOTFIX: recursión infinita en RLS entre despachos <-> despachos_pedidos
-- ============================================================================
-- La migración anterior (20260827170000_fix_fecha_entrega_despacho_y_
-- visibilidad_historial) agregó a despachos_select_operativo un EXISTS
-- crudo sobre despachos_pedidos para que el vendedor viera el despacho de
-- sus propios pedidos. Eso cerró un ciclo: despachos_pedidos_select_
-- operativo ya consultaba despachos, y pedidos_cabecera_select_operativo
-- (preexistente, 20260811221215) ya consultaba despachos_pedidos +
-- despachos. Postgres detecta la recursión mutua entre políticas de tablas
-- distintas y falla con "infinite recursion detected in policy for
-- relation despachos_pedidos" — rompió por completo el listado de pedidos
-- en producción (tenant base) apenas se aplicó.
--
-- Fix: mover los chequeos "vendedor dueño del pedido" a funciones
-- SECURITY DEFINER (propiedad de postgres, mismo patrón que
-- obtener_rol_actual()), que evalúan sobre las tablas sin volver a
-- disparar RLS, rompiendo el ciclo.
-- ============================================================================

CREATE OR REPLACE FUNCTION vendedor_es_dueno_del_pedido(p_pedido_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pedidos_cabecera pc
    WHERE pc.id = p_pedido_id
      AND pc.vendedor_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION vendedor_es_dueno_del_pedido(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION vendedor_es_dueno_del_pedido(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION despacho_incluye_pedido_de_vendedor(p_despacho_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM despachos_pedidos dp
    JOIN pedidos_cabecera pc ON pc.id = dp.pedido_id
    WHERE dp.despacho_id = p_despacho_id
      AND pc.vendedor_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION despacho_incluye_pedido_de_vendedor(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION despacho_incluye_pedido_de_vendedor(UUID) TO authenticated;

DROP POLICY IF EXISTS "despachos_pedidos_select_operativo" ON despachos_pedidos;
CREATE POLICY "despachos_pedidos_select_operativo" ON despachos_pedidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despachos d
      WHERE d.id = despachos_pedidos.despacho_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
          OR d.repartidor_id = auth.uid()
        )
    )
    OR (
      obtener_rol_actual() = 'vendedor'
      AND vendedor_es_dueno_del_pedido(despachos_pedidos.pedido_id)
    )
  );

DROP POLICY IF EXISTS "despachos_select_operativo" ON despachos;
CREATE POLICY "despachos_select_operativo" ON despachos
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR repartidor_id = auth.uid()
    OR (
      obtener_rol_actual() = 'vendedor'
      AND despacho_incluye_pedido_de_vendedor(despachos.id)
    )
  );
