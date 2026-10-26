// src/modules/reports/utils/priceList.js
import { formatMoneda } from "./salesReportFormat";

/**
 * Arma la lista de precios: una fila por producto con su precio normal, el
 * precio de cada tipo de precio activo (una columna por tipo, en el orden del
 * catálogo de tipos) y sus escalas al por mayor. Pura: recibe lo que trae el
 * servicio y no consulta nada.
 *
 * @param {{
 *   productos: Array<{ id: string, codigo: string, nombre: string, categoria: string|null, precio_venta: number|string }>,
 *   tipos: Array<{ id: string, nombre: string }>,
 *   preciosTipo: Array<{ producto_id: string, tipo_precio_id: string, precio: number }>,
 *   mayoristas: Array<{ producto_id: string, cantidad_minima: number, precio: number|string }>,
 * }} datos
 */
export const armarListaPrecios = ({ productos, tipos, preciosTipo, mayoristas }) => {
  const preciosPorProducto = new Map();
  for (const p of preciosTipo) {
    if (!preciosPorProducto.has(p.producto_id)) preciosPorProducto.set(p.producto_id, {});
    preciosPorProducto.get(p.producto_id)[p.tipo_precio_id] = Number(p.precio);
  }

  const escalasPorProducto = new Map();
  for (const m of mayoristas) {
    if (!escalasPorProducto.has(m.producto_id)) escalasPorProducto.set(m.producto_id, []);
    escalasPorProducto.get(m.producto_id).push({ cantidadMinima: Number(m.cantidad_minima), precio: Number(m.precio) });
  }

  const filas = productos.map((producto) => {
    const precios = preciosPorProducto.get(producto.id) ?? {};
    return {
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria || "",
      precioVenta: Number(producto.precio_venta) || 0,
      preciosTipo: Object.fromEntries(tipos.map((t) => [t.id, precios[t.id] ?? null])),
      escalas: (escalasPorProducto.get(producto.id) ?? []).sort((a, b) => a.cantidadMinima - b.cantidadMinima),
    };
  });

  return { tipos: tipos.map(({ id, nombre }) => ({ id, nombre })), filas };
};

/** Categorías presentes en la lista, ordenadas, para el filtro. */
export const categoriasDeLista = (filas) =>
  [...new Set(filas.map((f) => f.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

/** Filtra por texto (código o nombre) y por categoría exacta. */
export const filtrarListaPrecios = (filas, { busqueda = "", categoria = "" } = {}) => {
  const texto = busqueda.trim().toLowerCase();
  return filas.filter(
    (f) =>
      (!categoria || f.categoria === categoria) &&
      (!texto || f.nombre.toLowerCase().includes(texto) || f.codigo.toLowerCase().includes(texto)),
  );
};

/** "12+: $ 8.500 · 24+: $ 8.000", o "" sin escalas. */
export const formatEscalas = (escalas) =>
  escalas.map((e) => `${e.cantidadMinima}+: ${formatMoneda(e.precio)}`).join(" · ");
