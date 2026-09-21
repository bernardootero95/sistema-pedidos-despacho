import { PaymentsCard } from "../../payments/components/PaymentsCard";
import { paymentService } from "../../payments/services/paymentService";
import { useAuth } from "../../../context/useAuth";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";

// Mismos roles que valida registrar_abono_pedido en el servidor.
const ROLES_ABONO = ["soporte", "gerencia"];
const ESTADOS_ABONABLES = ["pendiente", "despachado"];

/**
 * Pagos de un pedido en su detalle. Decide cuándo mostrar la tarjeta y quién
 * puede abonar; la presentación vive en PaymentsCard.
 *
 * No renderiza nada si la empresa no usa métodos de pago ni abonos: el
 * detalle queda igual que antes (los pagos siguen registrándose en efectivo
 * por debajo, pero no aportan nada que mostrar).
 */
export const OrderPaymentsCard = ({ pedido, onActualizado }) => {
  const { user } = useAuth();
  const { metodosPagoActivo, abonosPedidosActivo } = useSettings();
  const { showSuccess } = useToast();

  if (!metodosPagoActivo && !abonosPedidosActivo) return null;

  const saldo = Math.max(
    (Number(pedido.total) || 0) - (Number(pedido.total_pagado) || 0),
    0,
  );

  const puedeAbonar =
    abonosPedidosActivo &&
    ROLES_ABONO.includes(user?.rol) &&
    ESTADOS_ABONABLES.includes(pedido.estado) &&
    saldo > 0;

  const handleAbonar = async (pagos) => {
    await paymentService.registrarAbonoPedido(pedido.id, pagos);
    showSuccess("Abono registrado.");
    await onActualizado?.();
  };

  return (
    <PaymentsCard
      total={pedido.total}
      pagado={pedido.total_pagado}
      puedeAbonar={puedeAbonar}
      subtituloAbono={`Pedido #${pedido.numero_pedido}`}
      cargarPagos={() => paymentService.getPagosPedido(pedido.id)}
      onAbonar={handleAbonar}
    />
  );
};
