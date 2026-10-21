-- ============================================================================
-- Pies de factura: mensajes que se imprimen al final de los comprobantes
-- ============================================================================
-- Mensajes libres (promociones, avisos, políticas) que soporte/gerencia
-- configura en Datos Empresa y que salen al pie de pedidos y facturas, en
-- tirilla y en carta. Pueden ser varios; solo se imprimen los activos, en
-- el orden en que se crearon.
--
-- Tabla de catálogo con el patrón del proyecto: `estado` (activar/desactivar
-- sin perder el texto), `creado`/`actualizado` y `eliminado` (borrado lógico).
-- La leen todos los roles porque todos imprimen comprobantes; solo
-- soporte/gerencia escriben (RLS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS pies_factura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje VARCHAR(300) NOT NULL CHECK (length(btrim(mensaje)) > 0),
  estado BOOLEAN NOT NULL DEFAULT true,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  eliminado TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pies_factura_vigentes_idx
  ON pies_factura (creado)
  WHERE eliminado IS NULL;

DROP TRIGGER IF EXISTS set_timestamp_pies_factura ON pies_factura;
CREATE TRIGGER set_timestamp_pies_factura
  BEFORE UPDATE ON pies_factura
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE pies_factura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pies_factura_select" ON pies_factura;
CREATE POLICY "pies_factura_select" ON pies_factura
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IS NOT NULL);

DROP POLICY IF EXISTS "pies_factura_write_admin" ON pies_factura;
CREATE POLICY "pies_factura_write_admin" ON pies_factura
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

REVOKE ALL ON TABLE pies_factura FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pies_factura TO authenticated;
