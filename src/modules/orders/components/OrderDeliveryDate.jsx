import { useState } from "react";
import { CalendarCheck, Pencil, Loader2, X, Check } from "lucide-react";
import { orderService } from "../services/orderService";

const formatFechaHora = (iso) =>
  new Date(iso).toLocaleString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// <input type="datetime-local"> espera "YYYY-MM-DDTHH:mm" en hora local,
// no un ISO en UTC.
const aInputLocal = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Muestra la fecha de entrega de un pedido entregado y, para
 * gerencia/soporte, permite corregirla vía `actualizar_fecha_entrega_pedido`
 * (el RPC valida en el servidor que sea un pedido entregado y una fecha
 * razonable; acá solo se replica esa validación para feedback inmediato).
 * No renderiza nada si el pedido todavía no está entregado.
 */
export const OrderDeliveryDate = ({ pedido, puedeEditar, onUpdated }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (pedido.estado !== "entregado") return null;

  const iniciarEdicion = () => {
    setValor(pedido.fecha_entrega ? aInputLocal(pedido.fecha_entrega) : "");
    setError("");
    setEditando(true);
  };

  const guardar = async () => {
    if (!valor) {
      setError("Selecciona una fecha y hora.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await orderService.actualizarFechaEntrega(pedido.id, new Date(valor));
      setEditando(false);
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="pt-2 border-t border-slate-100">
      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
        <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
        Fecha de Entrega:
      </p>

      {editando ? (
        <div className="mt-1.5 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <input
            type="datetime-local"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            max={aInputLocal(new Date().toISOString())}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors disabled:opacity-50"
              title="Guardar"
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              disabled={guardando}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm font-semibold text-slate-800">
            {pedido.fecha_entrega ? formatFechaHora(pedido.fecha_entrega) : "No registrada"}
          </p>
          {puedeEditar && (
            <button
              type="button"
              onClick={iniciarEdicion}
              className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
              title="Corregir fecha de entrega"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
