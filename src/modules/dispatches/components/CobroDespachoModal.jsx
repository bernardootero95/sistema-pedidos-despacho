import { useRef, useState, useImperativeHandle } from "react";
import { X, ShieldAlert, Loader2, Wallet, Check } from "lucide-react";
import { useSettings } from "../../../context/useSettings";
import { usePaymentLines } from "../../payments/hooks/usePaymentLines";
import { PaymentLinesEditor } from "../../payments/components/PaymentLinesEditor";
import { MODOS_PAGO, formatearMoneda } from "../../payments/utils/paymentLines";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { calcularSaldo } from "../utils/cobroEntrega";

/**
 * Sección de cobro de un pedido dentro del diálogo del despacho. Cada
 * sección maneja sus propias líneas de pago y le expone al diálogo padre
 * (vía ref) cómo validarse y qué pagos entregar.
 */
const PedidoCobroSeccion = ({ ref, pedido, disabled }) => {
  const { metodosPagoActivo, metodosPago } = useSettings();
  const saldo = calcularSaldo(pedido);
  const pago = usePaymentLines({
    objetivo: saldo,
    modo: MODOS_PAGO.EXACTO,
    metodosActivo: metodosPagoActivo,
  });

  useImperativeHandle(ref, () => ({
    validar: pago.validar,
    obtenerPagos: () => pago.payload,
  }));

  return (
    <section className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">#{pedido.numero_pedido}</p>
          <p className="text-xs text-slate-500 truncate">
            {getNombreCliente(pedido.clientes)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-slate-900">{formatearMoneda(saldo)}</p>
          {Number(pedido.total_pagado) > 0 && (
            <p className="text-[11px] text-amber-700 font-semibold">
              Abonado {formatearMoneda(Number(pedido.total_pagado))}
            </p>
          )}
        </div>
      </div>

      <PaymentLinesEditor
        lineas={pago.lineas}
        errores={pago.errores}
        errorGeneral={pago.errorGeneral}
        metodos={metodosPago}
        mostrarMetodos={metodosPagoActivo}
        objetivo={saldo}
        total={pago.total}
        disabled={disabled}
        onCambiar={pago.cambiar}
        onTocar={pago.tocar}
        onAgregar={pago.agregar}
        onQuitar={pago.quitar}
        onCompletar={pago.completar}
      />
    </section>
  );
};

/**
 * Diálogo único con el saldo de todos los pedidos de un despacho que siguen
 * pendientes de entrega, para completar la ruta cobrándolos a la vez.
 *
 * Con métodos de pago activos cada pedido lleva su propio reparto método +
 * monto. Sin ellos (solo abonos activos) no hay nada que elegir: se lista lo
 * que se cobra en efectivo y onConfirm recibe `null`.
 *
 * `pedidos` = pedidos con saldo (total, total_pagado, numero_pedido, clientes).
 * onConfirm recibe [{ pedido_id, pagos }] listo para la RPC.
 */
export const CobroDespachoModal = ({ pedidos, onConfirm, onCancel }) => {
  const { metodosPagoActivo } = useSettings();
  const seccionesRef = useRef({});
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  const totalPorCobrar = pedidos.reduce((acc, p) => acc + calcularSaldo(p), 0);

  const handleConfirmar = async () => {
    setErrorServidor("");

    let payload = null;
    if (metodosPagoActivo) {
      // Se valida cada sección (sin cortocircuito) para mostrar todos los
      // errores de una vez, no de a uno por intento.
      const validas = pedidos.map((p) => seccionesRef.current[p.id]?.validar());
      if (!validas.every(Boolean)) return;

      payload = pedidos.map((p) => ({
        pedido_id: p.id,
        pagos: seccionesRef.current[p.id].obtenerPagos(),
      }));
    }

    setEnviando(true);
    try {
      await onConfirm(payload);
    } catch (err) {
      setErrorServidor(err.message || "No se pudo completar el despacho.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cobrar saldos del despacho"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">
                Completar despacho
              </h2>
              <p className="text-xs text-slate-500">
                {pedidos.length}{" "}
                {pedidos.length === 1 ? "pedido con saldo" : "pedidos con saldo"}{" "}
                por cobrar · {formatearMoneda(totalPorCobrar)}
              </p>
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

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {errorServidor && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{errorServidor}</p>
            </div>
          )}

          {metodosPagoActivo ? (
            pedidos.map((pedido) => (
              <PedidoCobroSeccion
                key={pedido.id}
                pedido={pedido}
                disabled={enviando}
                ref={(instancia) => {
                  seccionesRef.current[pedido.id] = instancia;
                }}
              />
            ))
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {pedidos.map((pedido) => (
                <li
                  key={pedido.id}
                  className="p-3 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-bold text-slate-900">
                      #{pedido.numero_pedido}
                    </span>{" "}
                    <span className="text-slate-500">
                      {getNombreCliente(pedido.clientes)}
                    </span>
                  </span>
                  <span className="font-black text-slate-900 shrink-0">
                    {formatearMoneda(calcularSaldo(pedido))}
                  </span>
                </li>
              ))}
              <li className="p-3 text-xs text-slate-500 bg-slate-50 rounded-b-xl">
                Se cobra el saldo de cada pedido en efectivo.
              </li>
            </ul>
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
            {enviando ? "Completando..." : "Cobrar y completar"}
          </button>
        </div>
      </div>
    </div>
  );
};
