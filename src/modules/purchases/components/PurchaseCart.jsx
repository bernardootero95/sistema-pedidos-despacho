import { Trash2, PackageSearch } from "lucide-react";

/**
 * Tabla de líneas agregadas a la compra en curso, con cantidad y costo
 * unitario editables in situ. Componente de presentación puro (SRP): el
 * padre (usePurchaseCart) es la única fuente de verdad del carrito.
 */
export const PurchaseCart = ({
  carrito,
  onActualizarCantidad,
  onActualizarCosto,
  onEliminar,
  formatCurrency,
  total,
}) => {
  if (carrito.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-2">
        <PackageSearch className="h-8 w-8" />
        <p className="text-sm font-medium">
          Aún no agregas productos a esta compra.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-100">
        {carrito.map((linea) => (
          <div
            key={linea.producto_id}
            className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">
                {linea.nombre}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {linea.codigo}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-start">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={linea.cantidad}
                  onChange={(e) =>
                    onActualizarCantidad(
                      linea.producto_id,
                      Number(e.target.value),
                    )
                  }
                  className="w-20 p-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col items-start">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Costo Unit.
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={linea.costo_unitario}
                  onChange={(e) =>
                    onActualizarCosto(
                      linea.producto_id,
                      Number(e.target.value),
                    )
                  }
                  className="w-24 p-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col items-end min-w-20">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Subtotal
                </label>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(linea.cantidad * linea.costo_unitario)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onEliminar(linea.producto_id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">
          Total de la Compra
        </span>
        <span className="text-lg font-bold text-slate-900">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
};
