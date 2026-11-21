import { CalendarDays } from "lucide-react";
import { fechaHoyLocal } from "../utils/orderValidations";

/**
 * Selector de la fecha del pedido (por defecto hoy). Solo lo muestran los
 * perfiles que pueden registrar pedidos de días anteriores; el máximo es hoy.
 */
export const OrderDateField = ({ value, onChange, onBlur, error }) => {
  const hoy = fechaHoyLocal();
  const esAnterior = value && value < hoy;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <label
        htmlFor="fecha_pedido"
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5"
      >
        <CalendarDays className="h-4 w-4 text-blue-600" />
        Fecha del pedido *
      </label>
      <input
        id="fecha_pedido"
        type="date"
        value={value}
        max={hoy}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full sm:w-56 px-3 py-2.5 border rounded-xl text-sm text-slate-700 outline-none focus:ring-2 ${
          error
            ? "border-red-400 focus:ring-red-100"
            : "border-slate-300 focus:ring-blue-100 focus:border-blue-500"
        }`}
      />
      {error ? (
        <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>
      ) : (
        esAnterior && (
          <p className="text-amber-600 text-xs mt-1 font-medium">
            El pedido quedará registrado en un día anterior.
          </p>
        )
      )}
    </div>
  );
};
