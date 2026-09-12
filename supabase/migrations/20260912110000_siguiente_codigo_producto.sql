-- ----------------------------------------------------------------------------
-- RPC: obtener_siguiente_codigo_producto
-- Sugiere el próximo código consecutivo para un producto nuevo, tomando el
-- código numérico más alto ya registrado y sumándole 1, conservando su
-- mismo ancho de relleno con ceros (ej. si el último es "0122" -> "0123";
-- si es "001024" -> "001025"). Es solo una sugerencia editable en el
-- formulario: la unicidad real la sigue garantizando productos_codigo_key.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_siguiente_codigo_producto()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT lpad((codigo::bigint + 1)::text, length(codigo), '0')
      FROM productos
      WHERE codigo ~ '^[0-9]+$'
      ORDER BY codigo::bigint DESC
      LIMIT 1
    ),
    '0001'
  );
$$;

GRANT EXECUTE ON FUNCTION obtener_siguiente_codigo_producto() TO authenticated;
