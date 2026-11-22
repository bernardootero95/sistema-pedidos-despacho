import { useNavigate } from "react-router-dom";
import { purchaseService } from "../services/purchaseService";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import { useSettings } from "../../../context/useSettings";
import { PaymentStatusBadge } from "../../payments/components/PaymentStatusBadge";
import { PurchaseReceptionControl } from "../components/PurchaseReceptionControl";
import { OPCIONES_RECEPCION } from "../utils/purchaseReception";
import {
  ShoppingBag,
  Search,
  PlusCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

// timeZone: "UTC" porque fecha_compra puede venir sin hora (medianoche
// UTC) — en huso horario local negativo se mostraría un día atrás.
const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const PurchasesPage = () => {
  const { abonosComprasActivo } = useSettings();
  // El estado de pago solo aporta información si la empresa usa abonos a
  // compras: apagado, toda compra registrada está pagada completa.
  const mostrarPago = (compra) =>
    abonosComprasActivo && compra.estado === "registrada";
  const navigate = useNavigate();
  const {
    items: compras,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    filters: filtros,
    setFilters: setFiltros,
    reload: recargarCompras,
  } = usePaginatedList((page, pageSize, search, filtrosActivos) =>
    purchaseService.getComprasPaginadas(page, pageSize, search, filtrosActivos),
  );

  // Recibir suma stock y mueve el costo en el servidor (y con el filtro
  // "Pendientes" la compra sale de la lista): se recarga la página actual.
  const handleRecibida = () => recargarCompras();

  return (
    <div className="space-y-4 sm:space-y-6 relative flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary shrink-0" />
            <span>Compras</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Entradas de mercancía registradas a proveedores.
          </p>
        </div>
        <button
          onClick={() => navigate("/compras/nueva")}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nueva Compra</span>
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
            placeholder="Buscar por número de compra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          <select
            value={filtros.estadoRecepcion || ""}
            onChange={(e) =>
              setFiltros({ ...filtros, estadoRecepcion: e.target.value })
            }
            aria-label="Filtrar por estado de recepción"
            className="shrink-0 max-w-40 sm:max-w-none px-2 sm:px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 bg-white"
          >
            <option value="">Toda recepción</option>
            {OPCIONES_RECEPCION.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiquetaPlural}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && compras.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 flex justify-center items-center bg-white rounded-xl md:rounded-none md:border-none border border-slate-200">
              <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
              Cargando compras...
            </div>
          ) : compras.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 bg-white rounded-xl md:rounded-none md:border-none border border-slate-200 flex items-center justify-center">
              No se encontraron compras.
            </div>
          ) : (
            <>
              {/* === VISTA MÓVIL (Tarjetas) === */}
              <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pb-4">
                {compras.map((compra) => (
                  <div
                    key={compra.id}
                    className="bg-white border border-slate-200 rounded-xl shadow-sm"
                  >
                  {/* La acción de recepción va fuera del botón de la tarjeta:
                      un <button> no puede contener otro. */}
                  <button
                    onClick={() => navigate(`/compras/${compra.id}`)}
                    className="w-full text-left p-4 flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-slate-900">
                        Compra #{compra.numero_compra}
                      </p>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          compra.estado === "anulada"
                            ? "bg-red-100 text-red-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {compra.estado}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {compra.proveedor?.nombre_comercial}
                    </p>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {formatDate(compra.fecha_compra)}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(compra.total)}
                      </span>
                    </div>
                    {mostrarPago(compra) && (
                      <div>
                        <PaymentStatusBadge
                          total={compra.total}
                          pagado={compra.total_pagado}
                        />
                      </div>
                    )}
                  </button>
                  {compra.estado !== "anulada" && (
                    <div className="px-4 pb-4 flex justify-start">
                      <PurchaseReceptionControl
                        compra={compra}
                        variant="badge"
                        onRecibida={handleRecibida}
                      />
                    </div>
                  )}
                  </div>
                ))}
              </div>

              {/* === VISTA ESCRITORIO (Tabla) === */}
              <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-175">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3.5 px-6">Número</th>
                      <th className="py-3.5 px-6">Proveedor</th>
                      <th className="py-3.5 px-6">Fecha</th>
                      <th className="py-3.5 px-6 text-right">Total</th>
                      <th className="py-3.5 px-6 text-center">Estado</th>
                      <th className="py-3.5 px-6 text-center">Recepción</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {compras.map((compra) => (
                      <tr
                        key={compra.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-slate-900">
                          #{compra.numero_compra}
                        </td>
                        <td className="py-4 px-6 text-slate-700">
                          {compra.proveedor?.nombre_comercial}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {formatDate(compra.fecha_compra)}
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-slate-900">
                          {formatCurrency(compra.total)}
                          {mostrarPago(compra) && (
                            <div className="mt-1 font-normal">
                              <PaymentStatusBadge
                                total={compra.total}
                                pagado={compra.total_pagado}
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              compra.estado === "anulada"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {compra.estado}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center">
                            <PurchaseReceptionControl
                              compra={compra}
                              variant="badge"
                              onRecibida={handleRecibida}
                            />
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => navigate(`/compras/${compra.id}`)}
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
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
