import { useState, useEffect } from "react";
import { useAuth } from "../../../context/useAuth";
import { dispatchService } from "../services/dispatchService";
import { EntregaPedidoCard } from "../components/EntregaPedidoCard";
import { useRealtimeSubscription } from "../../../hooks/useRealtimeSubscription";
import { Truck, Loader2, PackageOpen, Calendar } from "lucide-react";

/**
 * Vista mobile-first para el rol repartidor: solo su ruta activa del día,
 * sin nada de lo que trae la página de escritorio (búsqueda, paginación,
 * edición de cabecera). Página delgada a propósito — el trabajo pesado
 * (llamar la RPC, manejar su propio loading/error) vive en cada
 * EntregaPedidoCard; esta página solo carga la lista y sincroniza el
 * estado local cuando una tarjeta avisa que se actualizó.
 */
export const RepartidorRoutePage = () => {
  const { user } = useAuth();
  const [despacho, setDespacho] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarRuta = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await dispatchService.obtenerRutaActivaRepartidor(
        user.id,
      );
      setDespacho(data?.despacho || null);
      setPedidos(data?.pedidos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(cargarRuta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Cubre tanto una ruta nueva asignada en el momento (despachos) como
  // correcciones de entrega hechas por otro rol sobre esta misma ruta
  // (despachos_pedidos) — en ambos casos, se refresca sola.
  useRealtimeSubscription("despachos", () => cargarRuta(), {
    filter: `repartidor_id=eq.${user.id}`,
  });
  useRealtimeSubscription("despachos_pedidos", () => cargarRuta(), {
    filter: despacho ? `despacho_id=eq.${despacho.id}` : undefined,
    enabled: Boolean(despacho),
  });

  const handleActualizado = (despachoPedidoId, nuevoEstado) => {
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === despachoPedidoId ? { ...p, estado_entrega: nuevoEstado } : p,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Cargando tu ruta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
        {error}
      </div>
    );
  }

  if (!despacho) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center text-slate-500 px-4">
        <PackageOpen className="w-12 h-12 text-slate-300" />
        <div>
          <p className="font-bold text-slate-700">
            No tienes una ruta activa
          </p>
          <p className="text-sm mt-1">
            Cuando te asignen un despacho, aparecerá acá.
          </p>
        </div>
      </div>
    );
  }

  const entregados = pedidos.filter(
    (p) => p.estado_entrega === "entregado",
  ).length;
  const pendientes = pedidos.filter(
    (p) => p.estado_entrega === "pendiente",
  ).length;

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Truck className="w-5 h-5 shrink-0" />
          <span className="font-black text-lg text-slate-900">
            {despacho.codigo_despacho}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          {new Date(despacho.fecha_despacho).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
          })}
          {despacho.vehiculo && ` · ${despacho.vehiculo.placa}`}
        </p>
        <p className="text-sm font-semibold text-slate-600 mt-2">
          {entregados} de {pedidos.length} entregados
          {pendientes > 0 && ` · ${pendientes} pendientes`}
        </p>
      </div>

      <div className="space-y-3">
        {pedidos.map((item) => (
          <EntregaPedidoCard
            key={item.id}
            item={item}
            onActualizado={handleActualizado}
          />
        ))}
      </div>
    </div>
  );
};
