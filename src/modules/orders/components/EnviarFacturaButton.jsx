import { useState } from "react";
import { FileText, Loader2, CheckCircle2 } from "lucide-react";
import { orderService } from "../services/orderService";

/**
 * Botón para que soporte envíe manualmente un pedido entregado a IngeFact
 * (facturación electrónica DIAN). Autónomo: llama directamente a
 * enviarFacturaIngefact y avisa al padre vía onEnviada para que recargue el
 * pedido -- mismo patrón que DispatchStatusControl/EntregaPedidoCard. Pide
 * una segunda confirmación antes de ejecutar (ver DispatchStatusControl):
 * enviar una factura a la DIAN es irreversible.
 */
export const EnviarFacturaButton = ({ pedido, onEnviada }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  if (pedido.ingefact_factura_id) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Facturado en IngeFact
        {pedido.ingefact_numero_factura ? ` — ${pedido.ingefact_numero_factura}` : ""}
      </div>
    );
  }

  if (pedido.estado !== "entregado") {
    return (
      <p className="text-xs text-slate-400 italic px-1">
        La factura se habilita cuando el pedido esté entregado.
      </p>
    );
  }

  const handleClick = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setCargando(true);
    setError("");
    try {
      await orderService.enviarFacturaIngefact(pedido.id);
      setConfirmando(false);
      onEnviada?.();
    } catch (err) {
      setError(err.message || "No se pudo enviar la factura.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
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
            <FileText className="h-4 w-4" />
          )}
          {confirmando ? "Confirmar envío a IngeFact" : "Enviar Factura"}
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
