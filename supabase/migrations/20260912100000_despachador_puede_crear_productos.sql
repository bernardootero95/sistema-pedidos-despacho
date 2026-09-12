-- ----------------------------------------------------------------------------
-- Despachador puede crear productos nuevos desde el flujo de Compras
-- (ej. llega un producto que aún no existe en el catálogo). No se amplía
-- su acceso a editar/eliminar productos existentes: eso sigue siendo solo
-- soporte/gerencia vía "productos_write_admin". Esta policy adicional de
-- INSERT se suma (permissive, se evalúan con OR) sin tocar esa restricción.
-- ----------------------------------------------------------------------------
CREATE POLICY "productos_insert_despachador" ON productos
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() = 'despachador');
