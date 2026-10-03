import { Plus, Minus, Trash2, Layers, Tag } from "lucide-react";

/**
 * Opciones de tipo de precio que se le ofrecen a quien arma el pedido para
 * una línea: Normal siempre; Mayorista si su rol puede y el producto tiene
 * franjas; y un botón por cada precio personalizado del producto cuyo tipo
 * permita el rol actual (tipos_precio.roles_permitidos). `tipoPrecioId`
 * distingue entre varios personalizados, que comparten el mismo `value`.
 */
const obtenerOpcionesLinea = (item, { puedeMayorista, rolActual }) => {
  const opciones = [
    { key: "normal", value: "normal", tipoPrecioId: null, label: "Normal" },
  ];

  if (puedeMayorista && item.tiersMayoristas?.length > 0) {
    opciones.push({
      key: "mayorista",
      value: "mayorista",
      tipoPrecioId: null,
      label: "Mayorista",
      icon: Layers,
    });
  }

  (item.preciosPersonalizados || [])
    .filter((precio) => precio.roles_permitidos.includes(rolActual))
    .forEach((precio) =>
      opciones.push({
        key: precio.tipo_precio_id,
        value: "personalizado",
        tipoPrecioId: precio.tipo_precio_id,
        label: precio.nombre,
        icon: Tag,
      }),
    );

  return opciones;
};

/**
 * Lista de productos agregados al pedido, con controles de cantidad y
 * eliminación. Componente puramente de presentación (SRP): toda la
 * validación de stock vive en orderValidations.js y se resuelve en el
 * padre (OrderCreatePage) antes de llegar aquí.
 *
 * El selector de tipo de precio por línea (Normal/Mayorista/personalizados)
 * solo muestra las opciones que el rol de quien arma el pedido puede usar
 * (puedeMayorista y `rolActual` los resuelve el padre desde el usuario
 * autenticado) Y que el producto de esa línea tiene configuradas — el
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
  rolActual = "",
  titulo = "Productos en el Pedido",
  mostrarStock = true,
}) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700">
        {titulo} ({carrito.length})
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
            const opcionesLinea = obtenerOpcionesLinea(item, {
              puedeMayorista,
              rolActual,
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
                    Cod: {item.codigo}
                    {mostrarStock && (
                      <>
                        {" | "}
                        <span className="text-emerald-600 font-medium">
                          Stock: {item.disponible}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs font-semibold text-blue-600 mt-1">
                    {formatCurrency(item.precio_unitario)} c/u
                  </p>

                  {mostrarSelectorPrecio && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {opcionesLinea.map((op) => {
                        const Icon = op.icon;
                        const activo =
                          item.tipo_precio === op.value &&
                          (item.tipo_precio_id ?? null) === op.tipoPrecioId;
                        return (
                          <button
                            key={op.key}
                            type="button"
                            onClick={() =>
                              onCambiarTipoPrecio(
                                index,
                                op.value,
                                op.tipoPrecioId,
                              )
                            }
                            title={op.label}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors max-w-full ${
                              activo
                                ? "bg-primary text-white"
                                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {Icon && <Icon className="h-3 w-3 shrink-0" />}
                            <span className="truncate max-w-32">{op.label}</span>
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
                      onClick={() => onModificarCantidad(index, -0.25)}
                      aria-label="Restar cantidad"
                      className="p-2 text-slate-600 hover:bg-slate-100 transition-colors active:bg-slate-200"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0"
                      value={item.cantidad}
                      onChange={(e) =>
                        onActualizarCantidadInput(index, e.target.value)
                      }
                      className="w-16 text-center font-bold text-slate-800 outline-none text-sm bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => onModificarCantidad(index, 0.25)}
                      aria-label="Sumar cantidad"
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
                    aria-label="Eliminar producto"
                    className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
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
