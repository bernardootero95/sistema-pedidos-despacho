// PostgREST corta cada respuesta en `max_rows` (1000 en Supabase por
// defecto) sin avisar: una consulta sin .range() que debería traer 1022
// productos devuelve 1000 y los demás simplemente "no existen" en la app.
export const TAMANO_PAGINA = 1000;

/**
 * Trae TODAS las filas de una consulta paginando en bloques de
 * TAMANO_PAGINA, para los catálogos que la app carga completos en memoria
 * (buscadores de productos/clientes/proveedores al armar un pedido o una
 * compra).
 *
 * `construirQuery` debe devolver una consulta NUEVA en cada llamada (un
 * builder de supabase-js no se puede reutilizar) y con un orden total
 * (desempatar por `id`): sin él, dos páginas pueden repetir u omitir filas.
 *
 * @param {() => import("@supabase/postgrest-js").PostgrestFilterBuilder} construirQuery
 * @returns {Promise<{ data: Array, error: object|null }>} mismo contrato que una consulta de supabase-js
 */
export async function obtenerTodasLasFilas(construirQuery) {
  const filas = [];

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await construirQuery().range(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { data: null, error };

    filas.push(...(data || []));
    if (!data || data.length < TAMANO_PAGINA) return { data: filas, error: null };
  }
}
