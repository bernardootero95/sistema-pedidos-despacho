import { PaymentModal } from "../../payments/components/PaymentModal";
import { MODOS_PAGO, formatearMoneda } from "../../payments/utils/paymentLines";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { calcularSaldo } from "../utils/cobroEntrega";

/**
 * Cobro del saldo de UN pedido al marcarlo como entregado (tarjeta del
 * repartidor y control de entrega del detalle de un despacho). Delgado a
 * propósito: la lógica de pagos vive en PaymentModal.
 */
export const CobroEntregaModal = ({ pedido, onConfirm, onCancel }) => {
  const abonado = Number(pedido?.total_pagado) || 0;

  return (
    <PaymentModal
      titulo={`Cobrar pedido #${pedido?.numero_pedido}`}
      subtitulo={getNombreCliente(pedido?.clientes)}
      objetivo={calcularSaldo(pedido)}
      modo={MODOS_PAGO.EXACTO}
      etiquetaConfirmar="Cobrar y entregar"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {abonado > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex justify-between">
          <span>
            Total {formatearMoneda(Number(pedido.total))} · ya abonado
          </span>
          <span className="font-bold">{formatearMoneda(abonado)}</span>
        </div>
      )}
    </PaymentModal>
  );
};
