import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { dispatchService } from "../services/dispatchService";
import { useSettings } from "../../../context/useSettings";
import { CobroDespachoModal } from "./CobroDespachoModal";
import { pedidosPorCobrar } from "../utils/cobroEntrega";
import {
  TRANSICIONES_VALIDAS_DESPACHO,
  ETIQUETAS_TRANSICION_DESPACHO,
  ESTILOS_ESTADO_DESPACHO,
  ETIQUETAS_ESTADO_DESPACHO,
} from "../utils/dispatchStatus";

/**
 * Control para cambiar el estado general de un despacho. Autónomo: llama
 * directamente a actualizarEstadoDespachoTransaccional y avisa al padre
 * vía onUpdated para que refresque su estado local. La anulación pide
 * una segunda confirmación antes de ejecutar (acción destructiva:
 * cascada a los pedidos asignados).
 *
 * Al completar un despacho cuyos pedidos aún tienen saldo por cobrar (y la
 * empresa usa métodos de pago o abonos) abre un solo diálogo con todos los
 * saldos antes de llamar a la RPC.
 *
 * variant="badge" (por defecto): burbuja compacta con menú desplegable,
 * pensada para una fila de tabla (DispatchesPage).
 * variant="buttons": fila de botones explícitos, pensada para el header
 * de una página de detalle (DispatchDetailsPage).
 */
export const DispatchStatusControl = ({
  despachoId,
  estado,
  onUpdated,
  variant = "badge",
}) => {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoAnular, setConfirmandoAnular] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [saldosPorCobrar, setSaldosPorCobrar] = useState(null);
  const menuRef = useRef(null);
  const { metodosPagoActivo, abonosPedidosActivo } = useSettings();

  const transiciones = TRANSICIONES_VALIDAS_DESPACHO[estado] || [];

  useEffect(() => {
    if (variant !== "badge") return undefined;
    const handleClickFuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setAbierto(false);
        setConfirmandoAnular(false);
      }
    };
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [variant]);

  const aplicarCambio = async (nuevoEstado, pagos = null) => {
    const actualizado =
      await dispatchService.actualizarEstadoDespachoTransaccional(
        despachoId,
        nuevoEstado,
        pagos,
      );
    onUpdated?.(actualizado.estado);
    setAbierto(false);
    setConfirmandoAnular(false);
  };

  const ejecutarCambio = async (nuevoEstado) => {
    if (nuevoEstado === "anulado" && !confirmandoAnular) {
      setConfirmandoAnular(true);
      return;
    }

    setCargando(true);
    setError("");
    try {
      if (
        nuevoEstado === "completado" &&
        (metodosPagoActivo || abonosPedidosActivo)
      ) {
        const items = await dispatchService.obtenerDetallesDespacho(despachoId);
        const conSaldo = pedidosPorCobrar(items);
        if (conSaldo.length > 0) {
          setSaldosPorCobrar(conSaldo);
          setAbierto(false);
          return;
        }
      }
      await aplicarCambio(nuevoEstado);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado.");
    } finally {
      setCargando(false);
    }
  };

  const handleCobrar = async (pagos) => {
    await aplicarCambio("completado", pagos);
    setSaldosPorCobrar(null);
  };

  const modalCobro = saldosPorCobrar && (
    <CobroDespachoModal
      pedidos={saldosPorCobrar}
      onConfirm={handleCobrar}
      onCancel={() => setSaldosPorCobrar(null)}
    />
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
        {transiciones.length > 0 && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {transiciones.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => ejecutarCambio(t)}
                disabled={cargando}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                  t === "anulado"
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
                {t === "anulado" && confirmandoAnular
                  ? "Confirmar anulación"
                  : ETIQUETAS_TRANSICION_DESPACHO[t]}
              </button>
            ))}
            {confirmandoAnular && (
              <button
                type="button"
                onClick={() => setConfirmandoAnular(false)}
                className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        {modalCobro}
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => transiciones.length > 0 && setAbierto((v) => !v)}
        disabled={cargando}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider transition-colors ${
          ESTILOS_ESTADO_DESPACHO[estado] ||
          "bg-slate-100 text-slate-800 border-slate-200"
        } ${transiciones.length > 0 ? "hover:brightness-95 cursor-pointer" : "cursor-default"}`}
      >
        {cargando ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          ETIQUETAS_ESTADO_DESPACHO[estado] || estado
        )}
        {transiciones.length > 0 && !cargando && (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {abierto && transiciones.length > 0 && (
        <div className="absolute z-10 mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-48 normal-case">
          {transiciones.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => ejecutarCambio(t)}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                t === "anulado"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t === "anulado" && confirmandoAnular
                ? "¿Confirmar anulación?"
                : ETIQUETAS_TRANSICION_DESPACHO[t]}
            </button>
          ))}
          {error && (
            <p className="px-3 py-1.5 text-[11px] text-red-500 font-medium">
              {error}
            </p>
          )}
        </div>
      )}
      {modalCobro}
    </div>
  );
};
