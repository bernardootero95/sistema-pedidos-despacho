import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dispatchService } from "../services/dispatchService";
import { orderService } from "../../orders/services/orderService";
import { DispatchStatusControl } from "../components/DispatchStatusControl";
import { EntregaStatusControl } from "../components/EntregaStatusControl";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { useToast } from "../../../context/useToast";
import { useRealtimeSubscription } from "../../../hooks/useRealtimeSubscription";
import { imprimirTiqueteYFacturasDespacho } from "../utils/dispatchPrintUtils";
import {
  ArrowLeft,
  Truck,
  User,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  StickyNote,
  Printer,
} from "lucide-react";
import { ETIQUETAS_ESTADO_DESPACHO } from "../utils/dispatchStatus";

export const DispatchDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [despacho, setDespacho] = useState(null);
  const [pedidosAsignados, setPedidosAsignados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [despachoData, pedidosData] = await Promise.all([
        dispatchService.getDespachoCompleto(id),
        dispatchService.obtenerDetallesDespacho(id),
      ]);
      setDespacho(despachoData);
      setPedidosAsignados(pedidosData);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información completa del despacho.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) queueMicrotask(cargarDatos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Si el repartidor marca una entrega desde su celular, o alguien más
  // cambia el estado del despacho, esta vista se refresca sola.
  useRealtimeSubscription("despachos_pedidos", () => cargarDatos(), {
    filter: `despacho_id=eq.${id}`,
    enabled: Boolean(id),
  });
  useRealtimeSubscription("despachos", () => cargarDatos(), {
    filter: `id=eq.${id}`,
    enabled: Boolean(id),
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Cuando el despacho cambia de estado (ej. a 'completado'), el servidor
  // puede cascadear el estado_entrega de los pedidos automáticamente:
  // recargamos todo para reflejarlo con exactitud en vez de adivinarlo.
  const handleDespachoActualizado = () => {
    cargarDatos();
  };

  const handleEntregaActualizada = (despachoPedidoId, resultado) => {
    setPedidosAsignados((prev) =>
      prev.map((p) =>
        p.id === despachoPedidoId
          ? { ...p, estado_entrega: resultado.estado_entrega }
          : p,
      ),
    );
  };

  const handleImprimirTiqueteYFacturas = async () => {
    if (pedidosAsignados.length === 0) return;
    setIsPrinting(true);
    try {
      const pedidosCompletos = await Promise.all(
        pedidosAsignados.map((item) =>
          orderService.getPedidoCompleto(item.pedido.id),
        ),
      );
      await imprimirTiqueteYFacturasDespacho(despacho, pedidosCompletos);
    } catch (err) {
      console.error(err);
      showError(
        err.message || "No se pudo generar el tiquete o las facturas.",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Cargando detalle del despacho...</p>
      </div>
    );
  }

  if (error || !despacho) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">
            {error || "Despacho no encontrado."}
          </p>
        </div>
        <button
          onClick={() => navigate("/despachos")}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a despachos
        </button>
      </div>
    );
  }

  const despachoAnulado = despacho.estado === "anulado";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6 pb-12">
      {/* BARRA SUPERIOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Despacho {despacho.codigo_despacho}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider bg-slate-100 text-slate-800 border-slate-200">
                {ETIQUETAS_ESTADO_DESPACHO[despacho.estado] || despacho.estado}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" />{" "}
              {formatDate(despacho.fecha_despacho)}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleImprimirTiqueteYFacturas}
            disabled={isPrinting || pedidosAsignados.length === 0}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimir Tiquete + Facturas
          </button>
          <DispatchStatusControl
            despachoId={despacho.id}
            estado={despacho.estado}
            onUpdated={handleDespachoActualizado}
            variant="buttons"
          />
        </div>
      </div>

      {/* GRID DE INFORMACIÓN GENERAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TARJETA VEHÍCULO */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-blue-600" /> Vehículo
          </h2>
          <div>
            <p className="text-base font-bold text-slate-900">
              {despacho.vehiculo?.placa || "N/A"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {despacho.vehiculo?.marca} {despacho.vehiculo?.modelo}
            </p>
          </div>
        </div>

        {/* TARJETA REPARTIDOR Y NOTAS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-emerald-600" /> Conductor / Repartidor
          </h2>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {despacho.repartidor?.nombre_completo || "No asignado"}
            </p>
          </div>
          {despacho.notas && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <StickyNote className="h-3.5 w-3.5" /> Notas de Ruta:
              </p>
              <p className="text-xs text-slate-700 italic mt-0.5">
                {despacho.notas}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TARJETA PEDIDOS ASIGNADOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
            <Package className="h-5 w-5 text-blue-600" />
            Pedidos en esta Ruta ({pedidosAsignados.length})
          </h2>
          {!despachoAnulado && (
            <p className="text-xs text-slate-400 hidden sm:block">
              Corrige aquí una entrega puntual (devolución, entrega anticipada)
            </p>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {pedidosAsignados.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Este despacho no tiene pedidos asignados.
            </div>
          ) : (
            pedidosAsignados.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                    Pedido #{item.pedido?.numero_pedido}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getNombreCliente(item.pedido?.clientes)}
                  </p>
                  {item.notas_entrega && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      "{item.notas_entrega}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-base font-bold text-slate-900">
                    {formatCurrency(item.pedido?.total)}
                  </p>
                  <EntregaStatusControl
                    despachoPedidoId={item.id}
                    estadoEntrega={item.estado_entrega}
                    disabled={despachoAnulado}
                    onUpdated={(resultado) =>
                      handleEntregaActualizada(item.id, resultado)
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
