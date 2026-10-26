import { useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Tags } from "lucide-react";
import { useClientPagination } from "../../../hooks/useClientPagination";
import { Pagination } from "../../../components/ui/Pagination";
import { reportService } from "../services/reportService";
import { useToast } from "../../../context/useToast";
import { fechaLocalISO } from "../utils/salesReportPeriod";
import { armarListaPrecios, categoriasDeLista, filtrarListaPrecios } from "../utils/priceList";
import { exportarListaPreciosExcel } from "../utils/priceListExcelUtils";
import { exportarListaPreciosPdf } from "../utils/priceListPdfUtils";
import { PriceListFilters } from "../components/PriceListFilters";
import { PriceListTable } from "../components/PriceListTable";

export const PriceListPage = () => {
  const { showError } = useToast();

  const [lista, setLista] = useState({ tipos: [], filas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    reportService
      .obtenerListaPrecios()
      .then((datos) => setLista(armarListaPrecios(datos)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => categoriasDeLista(lista.filas), [lista.filas]);

  // Las exportaciones usan lo filtrado: así se puede enviar la lista de una
  // sola categoría.
  const filasVisibles = useMemo(
    () => filtrarListaPrecios(lista.filas, { busqueda, categoria }),
    [lista.filas, busqueda, categoria],
  );

  const paginacion = useClientPagination(filasVisibles, { resetKey: `${busqueda}|${categoria}` });

  const exportar = async (formato) => {
    const fecha = fechaLocalISO();
    const datos = {
      filas: filasVisibles,
      tipos: lista.tipos,
      filtroLabel: [categoria || "Todas las categorías", busqueda.trim() && `búsqueda «${busqueda.trim()}»`, fecha]
        .filter(Boolean)
        .join(" · "),
      nombreArchivo: `lista-precios-${fecha}`,
    };

    try {
      setExportando(true);
      await (formato === "pdf" ? exportarListaPreciosPdf(datos) : exportarListaPreciosExcel(datos));
    } catch (err) {
      showError("No se pudo exportar la lista de precios: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  const puedeExportar = !loading && !error && filasVisibles.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Tags className="h-6 w-6 text-blue-600" />
            Lista de Precios
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Precio de venta de cada producto activo, con sus tipos de precio y precios al por mayor.
          </p>
        </div>

        {puedeExportar && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportar("pdf")}
              disabled={exportando}
              className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </button>
            <button
              type="button"
              onClick={() => exportar("excel")}
              disabled={exportando}
              className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        {loading && (
          <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            Cargando precios...
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-red-500 bg-white border border-slate-200 rounded-xl">Error: {error}</div>
        )}

        {!loading && !error && (
          <>
            <PriceListFilters
              busqueda={busqueda}
              categoria={categoria}
              categorias={categorias}
              onBusquedaChange={setBusqueda}
              onCategoriaChange={setCategoria}
            />

            <PriceListTable filas={paginacion.pageItems} tipos={lista.tipos} />
            <Pagination
              currentPage={paginacion.currentPage}
              totalPages={paginacion.totalPages}
              onPageChange={paginacion.setCurrentPage}
              pageSize={paginacion.pageSize}
              onPageSizeChange={paginacion.setPageSize}
              pageSizeOptions={[25, 50, 100, 200]}
              totalItems={paginacion.totalItems}
            />
          </>
        )}
      </div>
    </div>
  );
};
