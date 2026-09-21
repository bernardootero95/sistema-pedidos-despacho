import { PlusCircle, Trash2, ArrowDownToLine } from "lucide-react";
import { formatearMoneda } from "../utils/paymentLines";

const claseCampo = (error) =>
  `w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    error
      ? "border-red-400 focus:ring-red-200"
      : "border-slate-300 focus:ring-primary/20"
  }`;

/**
 * Editor de líneas de pago (método + monto), controlado por el hook
 * usePaymentLines. Presentacional puro: no conoce Supabase ni reglas de
 * negocio. Sin métodos de pago activos muestra una sola línea con el monto.
 */
export const PaymentLinesEditor = ({
  lineas,
  errores,
  errorGeneral,
  metodos,
  mostrarMetodos,
  objetivo,
  etiquetaObjetivo = "Saldo",
  total,
  disabled = false,
  onCambiar,
  onTocar,
  onAgregar,
  onQuitar,
  onCompletar,
}) => {
  const faltante = objetivo - total;

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {lineas.map((linea, index) => {
          const err = errores[linea.key] || {};
          return (
            <div key={linea.key} className="space-y-1">
              <div className="flex items-start gap-2">
                {mostrarMetodos && (
                  <div className="flex-1 min-w-0">
                    <select
                      aria-label={`Método de pago ${index + 1}`}
                      value={linea.metodo_pago_id}
                      disabled={disabled}
                      onChange={(e) =>
                        onCambiar(linea.key, "metodo_pago_id", e.target.value)
                      }
                      onBlur={() => onTocar(linea.key, "metodo_pago_id")}
                      className={claseCampo(err.metodo_pago_id)}
                    >
                      <option value="">Método de pago</option>
                      {metodos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <input
                    aria-label={`Monto ${index + 1}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder="Monto"
                    value={linea.monto}
                    disabled={disabled}
                    onChange={(e) => onCambiar(linea.key, "monto", e.target.value)}
                    onBlur={() => onTocar(linea.key, "monto")}
                    className={claseCampo(err.monto)}
                  />
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onCompletar(linea.key)}
                  title="Completar con lo que falta"
                  aria-label="Completar con lo que falta"
                  className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>

                {mostrarMetodos && lineas.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onQuitar(linea.key)}
                    title="Quitar"
                    aria-label="Quitar método"
                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {(err.metodo_pago_id || err.monto) && (
                <p className="text-xs text-red-500 font-bold">
                  {err.metodo_pago_id || err.monto}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {mostrarMetodos && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAgregar}
          className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover disabled:opacity-50"
        >
          <PlusCircle className="w-4 h-4" />
          Agregar otro método
        </button>
      )}

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>{etiquetaObjetivo}</span>
          <span className="font-bold text-slate-900">
            {formatearMoneda(objetivo)}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Ingresado</span>
          <span className="font-bold text-slate-900">
            {formatearMoneda(total)}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{faltante < 0 ? "Excede" : "Falta"}</span>
          <span
            className={`font-bold ${
              faltante === 0 ? "text-emerald-600" : faltante < 0 ? "text-red-600" : "text-amber-600"
            }`}
          >
            {formatearMoneda(Math.abs(faltante))}
          </span>
        </div>
      </div>

      {errorGeneral && (
        <p className="text-xs text-red-500 font-bold">{errorGeneral}</p>
      )}
    </div>
  );
};
