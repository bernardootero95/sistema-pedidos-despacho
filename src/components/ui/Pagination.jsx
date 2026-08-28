import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Genera la lista de números de página a mostrar, colapsando los tramos
// lejanos del actual en "…" (siempre deja primera, última y un rango
// alrededor de la página activa visibles) para no listar cientos de
// botones cuando hay muchas páginas.
function construirPaginas(currentPage, totalPages, delta = 2) {
  const paginas = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      paginas.push(i);
    }
  }

  const conElipsis = [];
  let anterior;
  for (const pagina of paginas) {
    if (anterior !== undefined) {
      if (pagina - anterior === 2) conElipsis.push(anterior + 1);
      else if (pagina - anterior !== 1) conElipsis.push("…");
    }
    conElipsis.push(pagina);
    anterior = pagina;
  }
  return conElipsis;
}

const botonNavClase =
  "p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

/**
 * Control de paginación estándar del proyecto: navegación por número de
 * página (con primera/última y elipsis) y, opcionalmente, un selector de
 * tamaño de página. Pensado para usarse junto con `usePaginatedList`.
 */
export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  totalItems,
}) => {
  const safeTotalPages = totalPages || 1;
  const paginas = construirPaginas(currentPage, safeTotalPages);
  const enPrimera = currentPage === 1;
  const enUltima = currentPage === safeTotalPages || safeTotalPages === 0;

  const irA = (pagina) => {
    if (pagina < 1 || pagina > safeTotalPages || pagina === currentPage) return;
    onPageChange(pagina);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
      {onPageSizeChange && (
        <div className="flex items-center gap-2 text-sm text-slate-500 order-2 sm:order-1">
          <label htmlFor="pagination-page-size">Mostrar</label>
          <select
            id="pagination-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap">
            por página{typeof totalItems === "number" ? ` · ${totalItems} en total` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 order-1 sm:order-2 overflow-x-auto">
        <button
          onClick={() => irA(1)}
          disabled={enPrimera || loading}
          title="Primera página"
          className={botonNavClase}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => irA(currentPage - 1)}
          disabled={enPrimera || loading}
          title="Página anterior"
          className={botonNavClase}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {paginas.map((pagina, idx) =>
          pagina === "…" ? (
            <span key={`dots-${idx}`} className="px-1.5 text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              key={pagina}
              onClick={() => irA(pagina)}
              disabled={loading}
              aria-current={pagina === currentPage ? "page" : undefined}
              className={`min-w-[2.25rem] px-2 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                pagina === currentPage
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 border border-slate-300 bg-white"
              }`}
            >
              {pagina}
            </button>
          ),
        )}

        <button
          onClick={() => irA(currentPage + 1)}
          disabled={enUltima || loading}
          title="Página siguiente"
          className={botonNavClase}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => irA(safeTotalPages)}
          disabled={enUltima || loading}
          title="Última página"
          className={botonNavClase}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
