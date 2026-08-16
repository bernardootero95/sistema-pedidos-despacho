import { useState } from "react";
import { PackageCheck, PackageX, Loader2, MapPin } from "lucide-react";
import { dispatchService } from "../services/dispatchService";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

/**
 * Tarjeta de un pedido dentro de la ruta del repartidor, con botones
 * grandes pensados para tocar con el dedo en el celular en movimiento.
 * Autónoma como EntregaStatusControl (mismo patrón): llama directamente a
 * actualizarEstadoEntregaPedido y avisa al padre vía onActualizado para
 * que sincronice su lista local, sin bloquear las demás tarjetas mientras
 * una está en vuelo.
 */
export const EntregaPedidoCard = ({ item, onActualizado }) => {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const estadoEntrega = item.estado_entrega;
  const cliente = item.pedido?.clientes;

  const handleActualizar = async (nuevoEstado) => {
    if (cargando || estadoEntrega === nuevoEstado) return;
    setCargando(true);
    setError("");
    try {
      await dispatchService.actualizarEstadoEntregaPedido(
        item.id,
        nuevoEstado,
      );
      onActualizado(item.id, nuevoEstado);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el pedido.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm bg-white ${
        estadoEntrega === "entregado"
          ? "border-emerald-200"
          : estadoEntrega === "rechazado"
            ? "border-red-200"
            : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-slate-900 text-lg leading-tight">
            #{item.pedido?.numero_pedido}
          </p>
          <p className="font-bold text-slate-700 truncate">
            {getNombreCliente(cliente)}
          </p>
        </div>
        <span className="font-black text-slate-900 text-lg shrink-0">
          {formatCurrency(item.pedido?.total)}
        </span>
      </div>

      {cliente?.direccion && (
        <div className="mt-2 flex items-start gap-1.5 text-sm text-slate-500">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{cliente.direccion}</span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500 font-semibold">{error}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={cargando}
          onClick={() => handleActualizar("entregado")}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
            estadoEntrega === "entregado"
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-700 active:bg-emerald-100"
          }`}
        >
          {cargando ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <PackageCheck className="w-7 h-7" />
          )}
          Entregado
        </button>
        <button
          type="button"
          disabled={cargando}
          onClick={() => handleActualizar("rechazado")}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
            estadoEntrega === "rechazado"
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-700 active:bg-red-100"
          }`}
        >
          {cargando ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <PackageX className="w-7 h-7" />
          )}
          Rechazado
        </button>
      </div>
    </div>
  );
};
