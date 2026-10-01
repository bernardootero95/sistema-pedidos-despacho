import { useState } from "react";
import { FileText, Loader2, CheckCircle2, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { orderService } from "../services/orderService";
import { getEstadoFacturaIngefact } from "../utils/facturaIngefactEstado";

const ESTILOS_AVISO = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  neutro: "text-slate-600 bg-slate-50 border-slate-200",
  error: "text-red-700 bg-red-50 border-red-200",
};

const Aviso = ({ tono, icon: Icon, children }) => (
  <div
    className={`flex items-start gap-2 text-sm font-medium border px-4 py-2.5 rounded-xl ${ESTILOS_AVISO[tono]}`}
  >
    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tono === "neutro" && Icon === Loader2 ? "animate-spin" : ""}`} />
    <span>{children}</span>
  </div>
);

/**
 * Estado de la factura electrónica (IngeFact) de un pedido y acción manual
 * de soporte: emitirla con la opción automática apagada, o reintentar una
 * emisión/anulación automática que falló. Autónomo: llama al servicio y
 * avisa al padre vía onActualizado para que recargue el pedido -- mismo
 * patrón que DispatchStatusControl. Pide una segunda confirmación antes de
 * ejecutar: emitir o anular un documento ante la DIAN es irreversible.
 */
export const FacturaIngefactControl = ({ pedido, onActualizado }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const estado = getEstadoFacturaIngefact(pedido);
  const numeroFactura = pedido.ingefact_numero_factura;

  const handleClick = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setCargando(true);
    setError("");
    try {
      await orderService.enviarFacturaIngefact(pedido.id, estado.accion);
      setConfirmando(false);
    } catch (err) {
      setError(err.message || "No se pudo completar la operación con IngeFact.");
    } finally {
      setCargando(false);
      // También tras un error: la Edge Function deja el motivo en el pedido.
      onActualizado?.();
    }
  };

  const aviso = {
    en_curso: (
      <Aviso tono="neutro" icon={Loader2}>
        {pedido.ingefact_estado === "anulando"
          ? "Anulando la factura en IngeFact…"
          : "Emitiendo la factura en IngeFact…"}
      </Aviso>
    ),
    vigente: (
      <Aviso tono="ok" icon={CheckCircle2}>
        Facturado en IngeFact{numeroFactura ? ` — ${numeroFactura}` : ""}
      </Aviso>
    ),
    anulada: (
      <Aviso tono="neutro" icon={Ban}>
        Factura{numeroFactura ? ` ${numeroFactura}` : ""} anulada
        {pedido.ingefact_numero_nota_credito
          ? ` (nota crédito ${pedido.ingefact_numero_nota_credito})`
          : ""}
      </Aviso>
    ),
    error: (
      <Aviso tono="error" icon={AlertTriangle}>
        {pedido.ingefact_estado === "error_anulacion"
          ? "No se pudo anular la factura"
          : "No se pudo emitir la factura"}
        {pedido.ingefact_error ? `: ${pedido.ingefact_error}` : "."}
      </Aviso>
    ),
  }[estado.aviso];

  if (!estado.accion) {
    if (aviso) return aviso;
    return (
      <p className="text-xs text-slate-400 italic px-1">
        La factura se habilita cuando el pedido esté entregado.
      </p>
    );
  }

  const esReintento = estado.aviso === "error" || estado.aviso === "en_curso";
  const etiqueta =
    estado.accion === "anular"
      ? confirmando ? "Confirmar anulación en IngeFact" : "Reintentar anulación"
      : confirmando ? "Confirmar envío a IngeFact" : esReintento ? "Reintentar factura" : "Enviar Factura";
  const IconoAccion = esReintento ? RotateCcw : FileText;

  return (
    <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
      {aviso}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={handleClick}
          disabled={cargando}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
            confirmando
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-800 hover:bg-slate-900 text-white"
          }`}
        >
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconoAccion className="h-4 w-4" />
          )}
          {etiqueta}
        </button>
        {confirmando && !cargando && (
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-2"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
