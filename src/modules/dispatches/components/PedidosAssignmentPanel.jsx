import React from "react";
import {
  Search,
  PackageCheck,
  PackagePlus,
  PackageMinus,
  Loader2,
  Inbox,
} from "lucide-react";

const nombreClientePedido = (pedido) =>
  pedido.clientes?.razon_social ||
  `${pedido.clientes?.primer_nombre || ""} ${pedido.clientes?.primer_apellido || ""}`.trim() ||
  "Cliente sin nombre";

/**
 * Panel de asignación de pedidos pendientes a la ruta de despacho.
 * Componente puramente de presentación (SRP): recibe las listas ya
 * filtradas y los manejadores desde el padre (DispatchCreatePage), no
 * gestiona su propio estado ni conoce reglas de negocio.
 */
export const PedidosAssignmentPanel = ({
  pedidosDisponibles,
  pedidosSeleccionados,
  searchTerm,
  onSearchChange,
  onAgregar,
  onQuitar,
  formatCurrency,
  loading,
  error,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-blue-500" />
          Pedidos de la Ruta
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {pedidosSeleccionados.length} pedido
          {pedidosSeleccionados.length !== 1 ? "s" : ""} asignado
          {pedidosSeleccionados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <p className="mx-5 mt-4 text-xs text-red-500 font-semibold bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
        {/* DISPONIBLES */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente o número de pedido..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : pedidosDisponibles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm text-center gap-2">
                <Inbox className="w-8 h-8 text-slate-300" />
                No hay pedidos pendientes disponibles.
              </div>
            ) : (
              pedidosDisponibles.map((pedido) => (
                <button
                  type="button"
                  key={pedido.id}
                  onClick={() => onAgregar(pedido)}
                  className="flex items-center justify-between gap-2 p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg text-left transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      #{pedido.numero_pedido} — {nombreClientePedido(pedido)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(pedido.total)}
                    </p>
                  </div>
                  <PackagePlus className="w-5 h-5 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* SELECCIONADOS */}
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-0.5">
            En esta ruta
          </p>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {pedidosSeleccionados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm text-center gap-2 border-2 border-dashed border-slate-100 rounded-lg">
                Selecciona pedidos de la izquierda para agregarlos aquí.
              </div>
            ) : (
              pedidosSeleccionados.map((pedido) => (
                <div
                  key={pedido.id}
                  className="flex items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      #{pedido.numero_pedido} — {nombreClientePedido(pedido)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(pedido.total)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuitar(pedido)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Quitar de la ruta"
                  >
                    <PackageMinus className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
