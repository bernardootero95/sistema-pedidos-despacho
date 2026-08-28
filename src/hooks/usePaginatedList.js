import { useState, useEffect } from "react";

/**
 * Encapsula el patrón estándar del proyecto para listas con paginación
 * server-side + búsqueda con debounce (antes reimplementado a mano en
 * ClientsPage, ProductsPage, VehiclesPage, OrdersPage y DispatchesPage).
 *
 * El debounce y el reseteo a la página 1 se disparan en el mismo setTimeout
 * a propósito: si se separaran en dos efectos encadenados (uno que debounce
 * el término y otro que reaccione a él para resetear la página), React
 * dispararía el fetch dos veces por cada búsqueda —una con la página vieja
 * y otra con la página ya reseteada— en vez de una sola vez.
 *
 * `queueMicrotask` en el efecto de carga evita el warning de ESLint por
 * setState sincrónico dentro de useEffect (mismo fix ya aplicado en los
 * listados existentes).
 *
 * `filters` es un objeto opcional de filtros adicionales (estado, rango de
 * fechas, etc.) controlado por quien use el hook. A diferencia de la
 * búsqueda de texto no lleva debounce propio (son selects/date pickers, no
 * tecleo), pero sí resetea a la página 1 igual que la búsqueda para no
 * dejar al usuario en una página fuera de rango.
 *
 * `pageSize` también es controlable en caliente vía `setPageSize` (además
 * del valor inicial en `options`), para listados que dejan elegir cuántos
 * elementos mostrar por página. Cambiarlo resetea a la página 1 por la
 * misma razón que los filtros.
 *
 * @param {(page: number, pageSize: number, search: string, filters: Object) => Promise<{data: unknown[], total: number, totalPages: number}>} fetchPage
 * @param {{ pageSize?: number, debounceMs?: number }} [options]
 */
export function usePaginatedList(fetchPage, options = {}) {
  const { pageSize: pageSizeInicial = 10, debounceMs = 500 } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(pageSizeInicial);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFiltersState] = useState({});

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [searchTerm, debounceMs]);

  const setFilters = (newFilters) => {
    setFiltersState(newFilters);
    setCurrentPage(1);
  };

  const setPageSize = (newPageSize) => {
    setPageSizeState(newPageSize);
    setCurrentPage(1);
  };

  const reload = async () => {
    try {
      setLoading(true);
      setError("");
      const {
        data,
        total,
        totalPages: pages,
      } = await fetchPage(currentPage, pageSize, debouncedSearch, filters);
      setItems(data);
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, JSON.stringify(filters)]);

  return {
    items,
    setItems,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    filters,
    setFilters,
    reload,
  };
}
