import { useState, useEffect } from "react";
import { Wallet, PlusCircle, Loader2 } from "lucide-react";
import { paymentService } from "../../payments/services/paymentService";
import { PaymentsHistory } from "../../payments/components/PaymentsHistory";
import { PaymentStatusBadge } from "../../payments/components/PaymentStatusBadge";
import { PaymentModal } from "../../payments/components/PaymentModal";
import { MODOS_PAGO, formatearMoneda } from "../../payments/utils/paymentLines";
import { useAuth } from "../../../context/useAuth";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";

// Mismos roles que valida registrar_abono_pedido en el servidor.
const ROLES_ABONO = ["soporte", "gerencia"];
const ESTADOS_ABONABLES = ["pendiente", "despachado"];

/**
 * Pagos de un pedido en su detalle: estado (pagado / abonado / sin pago),
 * saldo, historial de movimientos y, para soporte/gerencia con la opción de
 * abonos activa, el botón para registrar un abono.
 *
 * No renderiza nada si la empresa no usa pagos (ni métodos ni abonos) y el
 * pedido no tiene movimientos: el detalle queda igual que antes.
 */
export const OrderPaymentsCard = ({ pedido, onActualizado }) => {
  const { user } = useAuth();
  const { metodosPagoActivo, abonosPedidosActivo } = useSettings();
  const { showError, showSuccess } = useToast();
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abonando, setAbonando] = useState(false);

  const total = Number(pedido.total) || 0;
  const pagado = Number(pedido.total_pagado) || 0;
  const saldo = Math.max(total - pagado, 0);

  // Se vuelve a consultar cuando cambia lo pagado (tras un abono, o si otro
  // usuario cobra el pedido y la página se recarga).
  useEffect(() => {
    let vigente = true;
    paymentService
      .getPagosPedido(pedido.id)
      .then((data) => vigente && setPagos(data))
      .catch((err) => vigente && showError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id, pedido.total_pagado]);

  const puedeAbonar =
    abonosPedidosActivo &&
    ROLES_ABONO.includes(user?.rol) &&
    ESTADOS_ABONABLES.includes(pedido.estado) &&
    saldo > 0;

  const mostrar =
    metodosPagoActivo || abonosPedidosActivo || pagado > 0 || pagos.length > 0;
  if (!mostrar) return null;

  const handleAbonar = async (pagosNuevos) => {
    await paymentService.registrarAbonoPedido(pedido.id, pagosNuevos);
    setAbonando(false);
    showSuccess("Abono registrado.");
    await onActualizado?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <Wallet className="h-5 w-5 text-blue-600" />
          Pagos
          <PaymentStatusBadge total={total} pagado={pagado} />
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
            <p className="font-bold text-slate-900">{formatearMoneda(total)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pagado</p>
            <p className="font-bold text-emerald-700">
              {formatearMoneda(pagado)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Saldo</p>
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
          subtitulo={`Pedido #${pedido.numero_pedido}`}
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
