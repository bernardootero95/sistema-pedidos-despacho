import { Plus, Minus, Trash2, Layers, Snowflake, CreditCard } from "lucide-react";

const OPCIONES_TIPO_PRECIO = [
  { value: "normal", label: "Normal" },
  { value: "mayorista", label: "Mayorista", icon: Layers },
  { value: "frio", label: "Frío", icon: Snowflake },
  { value: "credito", label: "Crédito", icon: CreditCard },
];

/**
 * Lista de productos agregados al pedido, con controles de cantidad y
 * eliminación. Componente puramente de presentación (SRP): toda la
 * validación de stock vive en orderValidations.js y se resuelve en el
 * padre (OrderCreatePage) antes de llegar aquí.
 *
 * El selector de tipo de precio por línea (Normal/Mayorista/Frío/Crédito)
 * solo se muestra si el rol de quien arma el pedido puede usar esa opción
 * (puedeMayorista/puedeFrio/puedeCredito, resueltos por el padre desde el
 * rol autenticado) Y el producto de esa línea la tiene configurada — el
 * servidor vuelve a validar todo esto igual, esto es solo para no
 * mostrar un control que de todas formas el backend va a rechazar.
 */
export const CarritoPedido = ({
  carrito,
  onModificarCantidad,
  onActualizarCantidadInput,
  onCambiarTipoPrecio,
  onEliminar,
  formatCurrency,
  error,
  puedeMayorista = false,
  puedeFrio = false,
  puedeCredito = false,
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
          {carrito.map((item, index) => {
            const opcionesLinea = OPCIONES_TIPO_PRECIO.filter((op) => {
              if (op.value === "normal") return true;
              if (op.value === "mayorista")
                return puedeMayorista && item.tiersMayoristas?.length > 0;
              if (op.value === "frio")
                return puedeFrio && item.precio_frio != null;
              if (op.value === "credito")
                return puedeCredito && item.precio_credito != null;
              return false;
            });
            const mostrarSelectorPrecio = opcionesLinea.length > 1;

            return (
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

                  {mostrarSelectorPrecio && (
                    <div className="flex items-center gap-1 mt-2">
                      {opcionesLinea.map((op) => {
                        const Icon = op.icon;
                        const activo = item.tipo_precio === op.value;
                        return (
                          <button
                            key={op.value}
                            type="button"
                            onClick={() => onCambiarTipoPrecio(index, op.value)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              activo
                                ? "bg-primary text-white"
                                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {Icon && <Icon className="h-3 w-3" />}
                            {op.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.cantidad}
                      onChange={(e) =>
                        onActualizarCantidadInput(index, e.target.value)
                      }
                      className="w-16 text-center font-bold text-slate-800 outline-none text-sm bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    <span className="text-xs text-slate-400 block">
                      Subtotal
                    </span>
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
            );
          })}
        </div>
      )}
    </div>
  );
};
