import React from "react";
import { Search, Plus } from "lucide-react";

/**
 * Buscador de productos con stock visible y botón de agregar al carrito.
 * Componente puramente de presentación (SRP): recibe el catálogo y los
 * manejadores desde el padre, no gestiona su propio estado ni valida.
 */
export const ProductSearchBar = ({
  productos,
  productoSeleccionado,
  onSelectChange,
  onAgregar,
  error,
  formatCurrency,
}) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        Agregar Productos
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <select
            value={productoSeleccionado}
            onChange={(e) => onSelectChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl outline-none bg-white text-base focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          >
            <option value="">-- Seleccionar producto --</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id} disabled={p.disponible <= 0}>
                {p.codigo} - {p.nombre} ({formatCurrency(p.precio_venta)})
                [Stock: {p.disponible}] {p.disponible <= 0 ? "(AGOTADO)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onAgregar}
          disabled={!productoSeleccionado}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>
      )}
    </div>
  );
};
