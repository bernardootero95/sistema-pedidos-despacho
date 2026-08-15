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
 * @param {(page: number, pageSize: number, search: string) => Promise<{data: unknown[], total: number, totalPages: number}>} fetchPage
 * @param {{ pageSize?: number, debounceMs?: number }} [options]
 */
export function usePaginatedList(fetchPage, options = {}) {
  const { pageSize = 10, debounceMs = 500 } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [searchTerm, debounceMs]);

  const reload = async () => {
    try {
      setLoading(true);
      setError("");
      const {
        data,
        total,
        totalPages: pages,
      } = await fetchPage(currentPage, pageSize, debouncedSearch);
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
  }, [currentPage, debouncedSearch]);

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
    totalPages,
    totalItems,
    reload,
  };
}
