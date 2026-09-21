import { PaymentsCard } from "../../payments/components/PaymentsCard";
import { paymentService } from "../../payments/services/paymentService";
import { useAuth } from "../../../context/useAuth";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";
import { ROLES_MODULO } from "../../../config/roles";

/**
 * Pagos de una compra en su detalle: cuánto se ha pagado al proveedor, el
 * saldo pendiente y, con saldo, el botón para abonar. Los roles son los
 * mismos que validan las RPC (los del módulo de compras).
 *
 * El interruptor de abonos a compras gobierna si se pueden CREAR compras con
 * saldo; abonar una compra que ya lo tiene se permite siempre, para que
 * apagar la opción no deje deudas imposibles de saldar.
 *
 * No renderiza nada si la empresa no usa métodos de pago ni abonos.
 */
export const PurchasePaymentsCard = ({ compra, onActualizada }) => {
  const { user } = useAuth();
  const { metodosPagoActivo, abonosComprasActivo } = useSettings();
  const { showSuccess } = useToast();

  if (!metodosPagoActivo && !abonosComprasActivo) return null;

  const saldo = Math.max(
    (Number(compra.total) || 0) - (Number(compra.total_pagado) || 0),
    0,
  );

  const puedeAbonar =
    ROLES_MODULO.COMPRAS.includes(user?.rol) &&
    compra.estado === "registrada" &&
    saldo > 0;

  const handleAbonar = async (pagos) => {
    await paymentService.registrarAbonoCompra(compra.id, pagos);
    showSuccess("Abono registrado.");
    await onActualizada?.();
  };

  return (
    <PaymentsCard
      total={compra.total}
      pagado={compra.total_pagado}
      etiquetaSaldo="Saldo por pagar"
      puedeAbonar={puedeAbonar}
      subtituloAbono={`Compra #${compra.numero_compra}`}
      cargarPagos={() => paymentService.getPagosCompra(compra.id)}
      onAbonar={handleAbonar}
    />
  );
};
