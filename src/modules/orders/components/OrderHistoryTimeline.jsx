import { useState, useEffect } from "react";
import { History, Loader2 } from "lucide-react";
import { orderService } from "../services/orderService";
import { construirEventosHistorial } from "../utils/historialPedido";

/**
 * Historial de cambios de estado/fecha de entrega de un pedido, leído de
 * la tabla genérica `auditoria` (mismo mecanismo que ya audita
 * perfiles/roles). Se oculta por completo si no hay eventos relevantes
 * (pedido recién creado, sin cambios de estado todavía) en vez de mostrar
 * una tarjeta vacía.
 */
export const OrderHistoryTimeline = ({ pedidoId }) => {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    orderService
      .obtenerHistorialPedido(pedidoId)
      .then((registros) => {
        if (activo) setEventos(construirEventosHistorial(registros));
      })
      .catch(() => {})
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, [pedidoId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
      </div>
    );
  }

  if (eventos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <History className="h-5 w-5 text-blue-600" />
          Historial de Estados
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {eventos.map((evento) => (
          <li key={evento.id} className="p-4 sm:p-5 text-sm">
            <p className="text-slate-700">{evento.descripcion}</p>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(evento.fecha).toLocaleString("es-CO", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};
