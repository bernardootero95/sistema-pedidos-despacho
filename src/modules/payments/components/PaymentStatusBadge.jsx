import { formatearMoneda } from "../utils/paymentLines";

/**
 * Estado de pago de un pedido o compra a partir de total y total_pagado:
 * "Pagado", "Abonado $X" (con saldo) o "Sin pago". Presentacional, usable en
 * filas de tabla y en cabeceras de detalle.
 */
export const PaymentStatusBadge = ({ total, pagado }) => {
  const totalNum = Number(total) || 0;
  const pagadoNum = Number(pagado) || 0;

  let clases = "bg-slate-100 text-slate-600";
  let texto = "Sin pago";

  if (totalNum > 0 && pagadoNum >= totalNum) {
    clases = "bg-emerald-100 text-emerald-800";
    texto = "Pagado";
  } else if (pagadoNum > 0) {
    clases = "bg-amber-100 text-amber-800";
    texto = `Abonado ${formatearMoneda(pagadoNum)}`;
  }

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${clases}`}
    >
      {texto}
    </span>
  );
};
