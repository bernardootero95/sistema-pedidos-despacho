import { useState, useEffect } from "react";
import { Wallet, PlusCircle, Loader2 } from "lucide-react";
import { PaymentsHistory } from "./PaymentsHistory";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentModal } from "./PaymentModal";
import { MODOS_PAGO, formatearMoneda } from "../utils/paymentLines";
import { useToast } from "../../../context/useToast";

/**
 * Tarjeta de pagos de un documento (pedido o compra) para su página de
 * detalle: estado, total/pagado/saldo, historial de movimientos y, si se
 * permite, el botón para registrar un abono.
 *
 * Genérica a propósito: las reglas de quién puede abonar y cómo se guarda
 * viven en el wrapper de cada módulo (OrderPaymentsCard, PurchasePaymentsCard).
 *
 * - cargarPagos: () => Promise<pagos[]>; se vuelve a llamar cuando cambia
 *   `pagado` (tras un abono la página recarga el documento).
 * - onAbonar(pagos): registra el abono; si lanza, el modal muestra el error.
 */
export const PaymentsCard = ({
  total,
  pagado,
  etiquetaSaldo = "Saldo",
  puedeAbonar,
  subtituloAbono,
  cargarPagos,
  onAbonar,
}) => {
  const { showError } = useToast();
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abonando, setAbonando] = useState(false);

  const totalNum = Number(total) || 0;
  const pagadoNum = Number(pagado) || 0;
  const saldo = Math.max(totalNum - pagadoNum, 0);

  useEffect(() => {
    let vigente = true;
    cargarPagos()
      .then((data) => vigente && setPagos(data))
      .catch((err) => vigente && showError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // Solo depende de lo pagado: cargarPagos cambia de identidad en cada
    // render del wrapper y recargar por eso sería un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagadoNum]);

  const handleAbonar = async (pagosNuevos) => {
    await onAbonar(pagosNuevos);
    setAbonando(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <Wallet className="h-5 w-5 text-blue-600" />
          Pagos
          <PaymentStatusBadge total={totalNum} pagado={pagadoNum} />
        </h2>
        {puedeAbonar && (
          <button
            type="button"
            onClick={() => setAbonando(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Registrar abono
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-bold text-slate-900">
              {formatearMoneda(totalNum)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pagado</p>
            <p className="font-bold text-emerald-700">
              {formatearMoneda(pagadoNum)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{etiquetaSaldo}</p>
            <p
              className={`font-bold ${saldo > 0 ? "text-amber-600" : "text-slate-900"}`}
            >
              {formatearMoneda(saldo)}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <PaymentsHistory pagos={pagos} />
        )}
      </div>

      {abonando && (
        <PaymentModal
          titulo="Registrar abono"
          subtitulo={subtituloAbono}
          objetivo={saldo}
          modo={MODOS_PAGO.MAXIMO}
          etiquetaConfirmar="Registrar abono"
          onConfirm={handleAbonar}
          onCancel={() => setAbonando(false)}
        />
      )}
    </div>
  );
};
