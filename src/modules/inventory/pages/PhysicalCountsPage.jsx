import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye, Loader2, PlusCircle, Search, Warehouse } from "lucide-react";
import { physicalCountService } from "../services/physicalCountService";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import { useToast } from "../../../context/useToast";
import { ESTILOS_ESTADO_TOMA, ETIQUETAS_ESTADO_TOMA } from "../utils/physicalCountStatus";

const formatFecha = (fecha) =>
  fecha
    ? new Date(fecha).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const PhysicalCountsPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [creando, setCreando] = useState(false);

  const {
    items: tomas,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
  } = usePaginatedList((page, pageSize, search) => physicalCountService.getTomasPaginadas(page, pageSize, search));

  const enCurso = tomas.find((t) => t.estado === "borrador");

  const handleNueva = async () => {
    setCreando(true);
    try {
      const { id } = await physicalCountService.crearToma();
      navigate(`/bodega/toma-fisica/${id}`);
    } catch (err) {
      showError(err.message);
      setCreando(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary shrink-0" />
            <span>Toma Física</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cuenta la mercancía de la bodega, revisa las diferencias con el sistema y ajusta el inventario.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to="/bodega/inventario-actual"
            className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl sm:rounded-lg transition-colors"
          >
            <Warehouse className="w-4 h-4 shrink-0" />
            <span>Ver inventario actual</span>
          </Link>
          {enCurso ? (
            <button
              onClick={() => navigate(`/bodega/toma-fisica/${enCurso.id}`)}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Continuar toma #{enCurso.numero_toma}</span>
            </button>
          ) : (
            <button
              onClick={handleNueva}
              disabled={creando}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
            >
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4 shrink-0" />}
              <span>Nueva toma física</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shrink-0">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-2 sm:gap-3 shrink-0">
          <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por número de toma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        <div className="flex-1 overflow-x-auto">
          {loading && tomas.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex justify-center items-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
              Cargando tomas físicas...
            </div>
          ) : tomas.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Aún no hay tomas físicas.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-175">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Número</th>
                  <th className="py-3.5 px-6">Creada</th>
                  <th className="py-3.5 px-6">Responsable</th>
                  <th className="py-3.5 px-6">Aplicada</th>
                  <th className="py-3.5 px-6 text-center">Estado</th>
                  <th className="py-3.5 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {tomas.map((toma) => (
                  <tr key={toma.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">#{toma.numero_toma}</td>
                    <td className="py-4 px-6 text-slate-500 text-xs">{formatFecha(toma.creado)}</td>
                    <td className="py-4 px-6 text-slate-700">{toma.usuario?.nombre_completo}</td>
                    <td className="py-4 px-6 text-slate-500 text-xs">{formatFecha(toma.fecha_aplicacion)}</td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${ESTILOS_ESTADO_TOMA[toma.estado]}`}
                      >
                        {ETIQUETAS_ESTADO_TOMA[toma.estado]}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => navigate(`/bodega/toma-fisica/${toma.id}`)}
                        title="Ver toma"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between text-sm shrink-0">
            <span className="text-slate-500 font-medium">
              Página {currentPage} de {totalPages} <span className="hidden sm:inline">({totalItems} registros)</span>
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
