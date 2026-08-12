import React from "react";
import { Plus, Minus, Trash2 } from "lucide-react";

/**
 * Lista de productos agregados al pedido, con controles de cantidad y
 * eliminación. Componente puramente de presentación (SRP): toda la
 * validación de stock vive en orderValidations.js y se resuelve en el
 * padre (OrderCreatePage) antes de llegar aquí.
 */
export const CarritoPedido = ({
  carrito,
  onModificarCantidad,
  onActualizarCantidadInput,
  onEliminar,
  formatCurrency,
  error,
}) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700">
        Productos en el Pedido ({carrito.length})
      </h2>

      {error && (
        <p className="text-red-500 text-sm -mt-1 font-medium">{error}</p>
      )}

      {carrito.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
          No hay productos agregados todavía.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {carrito.map((item, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">
                  {item.nombre}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Cod: {item.codigo} |{" "}
                  <span className="text-emerald-600 font-medium">
                    Stock: {item.disponible}
                  </span>
                </p>
                <p className="text-xs font-semibold text-blue-600 mt-1">
                  {formatCurrency(item.precio_unitario)} c/u
                </p>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onModificarCantidad(index, -1)}
                    className="p-2 text-slate-600 hover:bg-slate-100 transition-colors active:bg-slate-200"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={item.cantidad}
                    onChange={(e) =>
                      onActualizarCantidadInput(index, e.target.value)
                    }
                    className="w-12 text-center font-bold text-slate-800 outline-none text-sm bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => onModificarCantidad(index, 1)}
                    className="p-2 text-slate-600 hover:bg-slate-100 transition-colors active:bg-slate-200"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-right min-w-22.5">
                  <span className="text-xs text-slate-400 block">Subtotal</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(item.subtotal_linea)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onEliminar(index)}
                  className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
