import { useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  PlusCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { quoteService } from "../services/quoteService";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

// timeZone UTC: fecha_vencimiento es un DATE (medianoche UTC al parsear).
const formatFecha = (valor) =>
  new Date(valor).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const QuotesPage = () => {
  const navigate = useNavigate();
  const {
    items: cotizaciones,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
  } = usePaginatedList((page, pageSize, search) =>
    quoteService.getCotizacionesPaginadas(page, pageSize, search),
  );

  return (
    <div className="space-y-4 sm:space-y-6 relative flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary shrink-0" />
            <span>Cotizaciones</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ofertas de precios a clientes; las aceptadas se convierten en pedido.
          </p>
        </div>
        <button
          onClick={() => navigate("/cotizaciones/nueva")}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nueva Cotización</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shrink-0">
          {error}
        </div>
      )}

      <div className="bg-transparent md:bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm flex flex-col flex-1 min-h-0">
        <div className="bg-white p-3 sm:p-4 rounded-xl md:rounded-none md:rounded-t-xl border border-slate-200 md:border-none md:border-b flex items-center gap-2 sm:gap-3 shrink-0 mb-4 md:mb-0 shadow-sm md:shadow-none">
          <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por número de cotización..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && cotizaciones.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 flex justify-center items-center bg-white rounded-xl md:rounded-none md:border-none border border-slate-200">
              <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
              Cargando cotizaciones...
            </div>
          ) : cotizaciones.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 bg-white rounded-xl md:rounded-none md:border-none border border-slate-200 flex items-center justify-center">
              No se encontraron cotizaciones.
            </div>
          ) : (
            <>
              {/* === VISTA MÓVIL (Tarjetas) === */}
              <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pb-4">
                {cotizaciones.map((cotizacion) => (
                  <button
                    key={cotizacion.id}
                    onClick={() => navigate(`/cotizaciones/${cotizacion.id}`)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-slate-900">
                        Cotización #{cotizacion.numero_cotizacion}
                      </p>
                      <QuoteStatusBadge cotizacion={cotizacion} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {getNombreCliente(cotizacion.cliente)}
                    </p>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        Hasta {formatFecha(cotizacion.fecha_vencimiento)}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(cotizacion.total)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* === VISTA ESCRITORIO (Tabla) === */}
              <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-175">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3.5 px-6">Número</th>
                      <th className="py-3.5 px-6">Cliente</th>
                      <th className="py-3.5 px-6">Válida hasta</th>
                      <th className="py-3.5 px-6 text-right">Total</th>
                      <th className="py-3.5 px-6 text-center">Estado</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {cotizaciones.map((cotizacion) => (
                      <tr
                        key={cotizacion.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-slate-900">
                          #{cotizacion.numero_cotizacion}
                        </td>
                        <td className="py-4 px-6 text-slate-700">
                          {getNombreCliente(cotizacion.cliente)}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {formatFecha(cotizacion.fecha_vencimiento)}
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-slate-900">
                          {formatCurrency(cotizacion.total)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <QuoteStatusBadge cotizacion={cotizacion} />
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => navigate(`/cotizaciones/${cotizacion.id}`)}
                            title="Ver detalle"
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-white md:bg-slate-50 md:rounded-b-xl flex items-center justify-between text-sm shrink-0 mt-4 md:mt-0 rounded-xl shadow-sm md:shadow-none">
            <span className="text-slate-500 font-medium">
              Página {currentPage} de {totalPages}{" "}
              <span className="hidden sm:inline">({totalItems} registros)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
