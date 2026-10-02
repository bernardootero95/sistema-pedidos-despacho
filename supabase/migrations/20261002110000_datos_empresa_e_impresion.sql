-- ============================================================================
-- Datos de la empresa, logo y formato de impresión de pedidos/facturas
-- ============================================================================
-- Los comprobantes impresos solo mostraban VITE_COMPANY_NAME. Para imprimir
-- en tamaño carta y como representación gráfica de la factura electrónica
-- hacen falta los datos del emisor (razón social, nombre comercial, NIT,
-- dirección, resolución DIAN), su logo, y el CUFE de la factura.
--
--   1. `datos_empresa`: fila única, mismo patrón que `configuracion_sistema`
--      (cada empresa tiene su propio proyecto Supabase). Tabla aparte y no
--      columnas de configuracion_sistema: son datos de identidad, no
--      interruptores funcionales.
--   2. Bucket público `empresa` para el logo: lo leen los comprobantes de
--      todos los roles, y un logo no es información sensible. Escritura
--      solo soporte/gerencia.
--   3. configuracion_sistema: `impresion_carta_activo` (apagado = tirilla
--      80mm, como hasta ahora) e `imprimir_logo_activo`.
--   4. pedidos_cabecera.ingefact_cufe: lo devuelve IngeFact al enviar la
--      factura; la Edge Function ahora lo guarda para el QR de la DIAN.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Datos de la empresa (fila única)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS datos_empresa (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  razon_social VARCHAR(200),
  nombre_comercial VARCHAR(200),
  nit VARCHAR(20),
  digito_verificacion VARCHAR(1),
  direccion VARCHAR(200),
  ciudad VARCHAR(100),
  telefono VARCHAR(50),
  correo VARCHAR(150),
  -- Texto libre tal como lo exige la DIAN en la representación gráfica
  -- (número, fecha, prefijo, rango y vigencia de la resolución).
  resolucion_facturacion TEXT,
  -- Ruta dentro del bucket `empresa` (no URL: la URL pública depende del
  -- proyecto y se arma en el frontend).
  logo_path TEXT,
  creado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  actualizado TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

INSERT INTO datos_empresa DEFAULT VALUES ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_timestamp_datos_empresa ON datos_empresa;
CREATE TRIGGER set_timestamp_datos_empresa
  BEFORE UPDATE ON datos_empresa
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

ALTER TABLE datos_empresa ENABLE ROW LEVEL SECURITY;

-- Todos los roles imprimen comprobantes.
CREATE POLICY "datos_empresa_select" ON datos_empresa
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IS NOT NULL);

CREATE POLICY "datos_empresa_update_admin" ON datos_empresa
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

REVOKE ALL ON TABLE datos_empresa FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE datos_empresa TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Bucket del logo
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('empresa', 'empresa', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- La lectura pública del archivo no pasa por RLS (bucket público); esta
-- política solo hace falta porque Storage exige SELECT para borrar/reemplazar.
CREATE POLICY "empresa_logo_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'empresa' AND obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "empresa_logo_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'empresa' AND obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "empresa_logo_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'empresa' AND obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (bucket_id = 'empresa' AND obtener_rol_actual() IN ('soporte', 'gerencia'));

CREATE POLICY "empresa_logo_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'empresa' AND obtener_rol_actual() IN ('soporte', 'gerencia'));

-- ----------------------------------------------------------------------------
-- 3. Interruptores de impresión
-- ----------------------------------------------------------------------------
ALTER TABLE configuracion_sistema
  ADD COLUMN IF NOT EXISTS impresion_carta_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imprimir_logo_activo BOOLEAN NOT NULL DEFAULT true;

-- ----------------------------------------------------------------------------
-- 4. CUFE de la factura electrónica
-- ----------------------------------------------------------------------------
ALTER TABLE pedidos_cabecera
  ADD COLUMN IF NOT EXISTS ingefact_cufe VARCHAR(120);
