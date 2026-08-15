-- ============================================================================
-- Resumen agregado para el Dashboard
-- ============================================================================
-- Antes el panel principal mostraba datos de demostración hardcodeados en el
-- frontend. Esta función centraliza los KPIs (ventas totales, pedidos,
-- pendientes, despachos activos) en una sola consulta con agregados SQL
-- (COUNT/SUM) en vez de traer todas las filas al cliente para sumarlas ahí:
-- escala igual con 50 pedidos que con 500.000.
--
-- No es SECURITY DEFINER a propósito: corre con los privilegios de quien la
-- invoca, así que las políticas RLS de pedidos_cabecera y despachos
-- (20260811221215_rls_permisos_por_rol.sql) siguen aplicando tal cual — un
-- repartidor solo ve sus propios despachos en el resultado, un vendedor ve
-- sus pedidos, etc. — sin duplicar esa lógica de alcance aquí.
-- ============================================================================
CREATE OR REPLACE FUNCTION obtener_resumen_dashboard()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_pedidos', (
      SELECT COUNT(*) FROM pedidos_cabecera WHERE eliminado IS NULL
    ),
    'pedidos_pendientes', (
      SELECT COUNT(*) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado = 'pendiente'
    ),
    'ventas_totales', (
      SELECT COALESCE(SUM(total), 0) FROM pedidos_cabecera
      WHERE eliminado IS NULL AND estado <> 'anulado'
    ),
    'despachos_activos', (
      SELECT COUNT(*) FROM despachos
      WHERE eliminado IS NULL AND estado = 'en_ruta'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION obtener_resumen_dashboard() TO authenticated;
