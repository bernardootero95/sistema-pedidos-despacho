-- ============================================================================
-- Valores ya usados de tipo, departamento, línea y categoría de los productos
-- ============================================================================
-- Estos cuatro campos son texto libre en `productos` (los carga el sistema
-- contable externo y el formulario de producto). Para que el formulario deje
-- ESCOGER entre los ya creados o agregar uno nuevo, necesita la lista de
-- valores en uso. Se obtiene con una sola consulta agregada en el servidor en
-- vez de bajar todo el catálogo al navegador (que además PostgREST corta a
-- 1000 filas).
--
-- No hay tabla de catálogo nueva a propósito: el valor vive en cada producto
-- y la lista se deriva de ellos, así un valor nuevo aparece en cuanto se
-- guarda un producto que lo usa y no hay catálogos que mantener sincronizados
-- con la carga de Excel. Los valores que solo difieren en mayúsculas o
-- espacios se muestran una vez ("Bebidas" y "bebidas " son el mismo).
--
-- SECURITY INVOKER (por defecto): respeta el RLS de `productos`, así cada rol
-- ve solo lo que ya puede leer.
-- ============================================================================
CREATE OR REPLACE FUNCTION obtener_clasificaciones_productos()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tipos', COALESCE((
      SELECT jsonb_agg(v ORDER BY lower(v))
      FROM (
        SELECT DISTINCT ON (lower(btrim(tipo))) btrim(tipo) AS v
        FROM productos
        WHERE eliminado IS NULL AND btrim(COALESCE(tipo, '')) <> ''
        ORDER BY lower(btrim(tipo)), btrim(tipo)
      ) t
    ), '[]'::jsonb),
    'departamentos', COALESCE((
      SELECT jsonb_agg(v ORDER BY lower(v))
      FROM (
        SELECT DISTINCT ON (lower(btrim(departamento))) btrim(departamento) AS v
        FROM productos
        WHERE eliminado IS NULL AND btrim(COALESCE(departamento, '')) <> ''
        ORDER BY lower(btrim(departamento)), btrim(departamento)
      ) t
    ), '[]'::jsonb),
    'lineas', COALESCE((
      SELECT jsonb_agg(v ORDER BY lower(v))
      FROM (
        SELECT DISTINCT ON (lower(btrim(linea))) btrim(linea) AS v
        FROM productos
        WHERE eliminado IS NULL AND btrim(COALESCE(linea, '')) <> ''
        ORDER BY lower(btrim(linea)), btrim(linea)
      ) t
    ), '[]'::jsonb),
    'categorias', COALESCE((
      SELECT jsonb_agg(v ORDER BY lower(v))
      FROM (
        SELECT DISTINCT ON (lower(btrim(categoria))) btrim(categoria) AS v
        FROM productos
        WHERE eliminado IS NULL AND btrim(COALESCE(categoria, '')) <> ''
        ORDER BY lower(btrim(categoria)), btrim(categoria)
      ) t
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION obtener_clasificaciones_productos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION obtener_clasificaciones_productos() TO authenticated;
