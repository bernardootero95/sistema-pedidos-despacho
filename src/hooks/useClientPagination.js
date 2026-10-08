import { useState } from "react";

/**
 * Paginación en el cliente para tablas cuyos datos ya están completos en
 * memoria (informes de inventario, toma física), pensada para usarse con el
 * componente `Pagination`. Para listas con volumen real de datos se usa
 * `usePaginatedList` (paginación server-side).
 *
 * `resetKey` identifica el filtro/búsqueda vigente: cuando cambia, la lista
 * vuelve a la página 1 sin necesidad de un efecto. La página también se
 * acota al rango válido si la lista se acorta.
 *
 * @template T
 * @param {T[]} items
 * @param {{ pageSize?: number, resetKey?: unknown }} [options]
 */
export function useClientPagination(items, { pageSize: pageSizeInicial = 50, resetKey = null } = {}) {
  const [pageSize, setPageSizeState] = useState(pageSizeInicial);
  const [pagina, setPagina] = useState({ numero: 1, clave: resetKey });

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const numeroVigente = pagina.clave === resetKey ? pagina.numero : 1;
  const currentPage = Math.min(numeroVigente, totalPages);

  const setCurrentPage = (numero) => setPagina({ numero, clave: resetKey });

  const setPageSize = (tamano) => {
    setPageSizeState(tamano);
    setPagina({ numero: 1, clave: resetKey });
  };

  return {
    pageItems: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: items.length,
    pageSize,
    setPageSize,
  };
}
