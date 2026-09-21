import { AlertTriangle, Loader2 } from "lucide-react";
import { formatearMoneda } from "../../payments/utils/paymentLines";

/**
 * Confirmación explícita al guardar la edición de un pedido cuyo nuevo total
 * queda por debajo de lo ya abonado: la diferencia se devuelve al cliente y
 * queda registrada como devolución en los pagos del pedido.
 */
export const DevolucionConfirmModal = ({
  monto,
  enviando = false,
  onConfirm,
  onCancel,
}) => (
  <div
    role="alertdialog"
    aria-modal="true"
    aria-label="Confirmar devolución"
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
  >
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            El nuevo total es menor a lo abonado
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Al guardar se registrará la devolución de{" "}
            <span className="font-bold text-slate-900">
              {formatearMoneda(monto)}
            </span>{" "}
            al cliente. ¿Deseas continuar?
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={enviando}
          className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Volver a editar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={enviando}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar y devolver
        </button>
      </div>
    </div>
  </div>
);
