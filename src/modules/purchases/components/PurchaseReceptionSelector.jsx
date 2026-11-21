import { OPCIONES_RECEPCION } from "../utils/purchaseReception";

/**
 * Selector del estado de recepción al registrar una compra ("Recibida" por
 * defecto). Presentacional: el valor y su validación viven en la página.
 */
export const PurchaseReceptionSelector = ({ value, onChange, error }) => {
  const seleccionada = OPCIONES_RECEPCION.find((o) => o.valor === value);

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">
        Estado de recepción *
      </span>
      <div
        role="radiogroup"
        aria-label="Estado de recepción"
        className={`grid grid-cols-2 gap-1 p-1 rounded-xl border bg-slate-50 ${error ? "border-red-500 ring-2 ring-red-100" : "border-slate-300"}`}
      >
        {OPCIONES_RECEPCION.map((opcion) => {
          const activa = opcion.valor === value;
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onChange(opcion.valor)}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${activa ? "bg-white text-blue-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>
      ) : (
        seleccionada && (
          <p className="text-xs text-slate-500 mt-1">{seleccionada.descripcion}</p>
        )
      )}
    </div>
  );
};
