import { useState } from "react";
import { X, ShieldAlert, Loader2, Wallet, Check } from "lucide-react";
import { useSettings } from "../../../context/useSettings";
import { usePaymentLines } from "../hooks/usePaymentLines";
import { PaymentLinesEditor } from "./PaymentLinesEditor";
import { MODOS_PAGO, formatearMoneda } from "../utils/paymentLines";

/**
 * Diálogo para registrar uno o varios pagos (método + monto) contra un
 * objetivo (saldo de un pedido, total de una compra...). Lo usan el cobro al
 * entregar, los abonos y el pago de compras.
 *
 * - modo EXACTO: la suma debe igualar el objetivo.
 * - modo MAXIMO: al menos un pago, sin superar el objetivo (abonos).
 * - modo OPCIONAL: puede quedar sin pago, sin superar el objetivo.
 *
 * Sin métodos de pago activos y en modo EXACTO no hay nada que elegir: el
 * diálogo solo confirma el cobro en efectivo (onConfirm recibe `null` y el
 * servidor lo resuelve a Efectivo).
 *
 * No usa <form> a propósito: se monta dentro de páginas que ya tienen su
 * propio formulario, y un submit dentro de un portal/anidado dispararía el
 * del padre.
 *
 * Se monta al abrir (renderizado condicional del padre), así el estado de las
 * líneas empieza limpio cada vez.
 */
export const PaymentModal = ({
  titulo,
  subtitulo,
  objetivo,
  etiquetaObjetivo = "Saldo",
  modo = MODOS_PAGO.EXACTO,
  etiquetaConfirmar = "Confirmar",
  onConfirm,
  onCancel,
  children,
}) => {
  const { metodosPagoActivo, metodosPago } = useSettings();
  const soloConfirmar = !metodosPagoActivo && modo === MODOS_PAGO.EXACTO;

  const pago = usePaymentLines({
    objetivo,
    modo,
    metodosActivo: metodosPagoActivo,
  });
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  const handleConfirmar = async () => {
    setErrorServidor("");
    if (!soloConfirmar && !pago.validar()) return;

    setEnviando(true);
    try {
      await onConfirm(soloConfirmar ? null : pago.payload);
    } catch (err) {
      setErrorServidor(err.message || "No se pudo registrar el pago.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {titulo}
              </h2>
              {subtitulo && (
                <p className="text-xs text-slate-500 truncate">{subtitulo}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={enviando}
            aria-label="Cerrar"
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {errorServidor && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{errorServidor}</p>
            </div>
          )}

          {children}

          {soloConfirmar ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex justify-between items-center">
              <span>{etiquetaObjetivo} a cobrar en efectivo</span>
              <span className="font-black text-lg text-slate-900">
                {formatearMoneda(objetivo)}
              </span>
            </div>
          ) : (
            <PaymentLinesEditor
              lineas={pago.lineas}
              errores={pago.errores}
              errorGeneral={pago.errorGeneral}
              metodos={metodosPago}
              mostrarMetodos={metodosPagoActivo}
              objetivo={objetivo}
              etiquetaObjetivo={etiquetaObjetivo}
              total={pago.total}
              disabled={enviando}
              onCambiar={pago.cambiar}
              onTocar={pago.tocar}
              onAgregar={pago.agregar}
              onQuitar={pago.quitar}
              onCompletar={pago.completar}
            />
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={enviando}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={enviando}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {enviando ? "Registrando..." : etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
};
