import { Wallet } from "lucide-react";
import { formatearMoneda } from "../utils/paymentLines";

const ETIQUETAS_TIPO = {
  entrega: "Cobro en entrega",
  pago: "Pago",
  abono: "Abono",
  devolucion: "Devolución",
};

const formatFecha = (fechaISO) =>
  new Date(fechaISO).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Lista de movimientos de dinero de un pedido o compra. Presentacional: recibe
 * los pagos ya cargados (paymentService.getPagos*). Las devoluciones se
 * muestran en rojo y con signo negativo.
 */
export const PaymentsHistory = ({ pagos }) => {
  if (!pagos || pagos.length === 0) {
    return (
      <p className="text-sm text-slate-500">Aún no hay pagos registrados.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {pagos.map((pago) => {
        const esDevolucion = pago.tipo === "devolucion";
        return (
          <li
            key={pago.id}
            className="py-2.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  esDevolucion
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {ETIQUETAS_TIPO[pago.tipo] || pago.tipo}
                  <span className="font-normal text-slate-500">
                    {" · "}
                    {pago.metodo?.nombre || "—"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {formatFecha(pago.creado)}
                  {pago.registrador?.nombre_completo
                    ? ` · ${pago.registrador.nombre_completo}`
                    : ""}
                </p>
              </div>
            </div>
            <span
              className={`text-sm font-black shrink-0 ${
                esDevolucion ? "text-red-600" : "text-slate-900"
              }`}
            >
              {esDevolucion ? "−" : ""}
              {formatearMoneda(Number(pago.monto))}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
