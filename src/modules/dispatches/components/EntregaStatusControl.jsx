import { useState } from "react";
import { Clock, PackageCheck, PackageX, Loader2 } from "lucide-react";
import { dispatchService } from "../services/dispatchService";
import { ETIQUETAS_ESTADO_ENTREGA } from "../utils/dispatchStatus";
import { useSettings } from "../../../context/useSettings";
import { CobroEntregaModal } from "./CobroEntregaModal";
import { requiereCobroAlEntregar } from "../utils/cobroEntrega";

const OPCIONES = [
  { value: "pendiente", Icon: Clock, activo: "bg-slate-600 text-white" },
  {
    value: "entregado",
    Icon: PackageCheck,
    activo: "bg-emerald-600 text-white",
  },
  { value: "rechazado", Icon: PackageX, activo: "bg-red-600 text-white" },
];

/**
 * Control segmentado para corregir el estado de entrega de un pedido
 * puntual dentro de un despacho (por ejemplo, marcarlo devuelto aunque
 * el despacho como un todo siga 'en_ruta' o ya esté 'completado').
 * Autónomo: llama directamente a actualizarEstadoEntregaPedido y avisa
 * al padre vía onUpdated para refrescar su lista local.
 *
 * Marcar 'entregado' un pedido con saldo por cobrar abre antes el diálogo
 * de cobro; `pedido` trae total, total_pagado y los datos para mostrarlo.
 */
export const EntregaStatusControl = ({
  despachoPedidoId,
  estadoEntrega,
  pedido,
  onUpdated,
  disabled = false,
}) => {
  const settings = useSettings();
  const [cargando, setCargando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState("");

  const actualizar = async (nuevoEstado, pagos = null) => {
    const resultado = await dispatchService.actualizarEstadoEntregaPedido(
      despachoPedidoId,
      nuevoEstado,
      null,
      pagos,
    );
    onUpdated?.(resultado);
  };

  const handleClick = async (nuevoEstado) => {
    if (nuevoEstado === estadoEntrega || disabled || cargando) return;

    if (nuevoEstado === "entregado" && requiereCobroAlEntregar(pedido, settings)) {
      setCobrando(true);
      return;
    }

    setCargando(true);
    setError("");
    try {
      await actualizar(nuevoEstado);
    } catch (err) {
      setError(err.message || "No se pudo actualizar.");
    } finally {
      setCargando(false);
    }
  };

  const handleCobrar = async (pagos) => {
    await actualizar("entregado", pagos);
    setCobrando(false);
  };

  return (
    <div className="flex flex-col items-start sm:items-end gap-1">
      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
        {OPCIONES.map(({ value, Icon, activo }) => {
          const esActivo = value === estadoEntrega;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled || cargando}
              onClick={() => handleClick(value)}
              title={ETIQUETAS_ESTADO_ENTREGA[value]}
              className={`p-1.5 border-l border-slate-200 first:border-l-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                esActivo
                  ? activo
                  : "bg-white text-slate-300 hover:text-slate-500 hover:bg-slate-50"
              }`}
            >
              {cargando && esActivo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-[10px] text-red-500 font-medium max-w-40 text-right">
          {error}
        </p>
      )}

      {cobrando && (
        <CobroEntregaModal
          pedido={pedido}
          onConfirm={handleCobrar}
          onCancel={() => setCobrando(false)}
        />
      )}
    </div>
  );
};
