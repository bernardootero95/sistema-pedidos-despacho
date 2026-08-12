import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dispatchService } from "../services/dispatchService";
import {
  ArrowLeft,
  Truck,
  User,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  StickyNote,
} from "lucide-react";

// Solo estas transiciones están permitidas para el estado general del
// despacho: un despacho creado puede pasar a ruta o anularse; uno en ruta
// puede completarse o anularse; completado/anulado son estados finales.
const TRANSICIONES_VALIDAS = {
  creado: ["en_ruta", "anulado"],
  en_ruta: ["completado", "anulado"],
  completado: [],
  anulado: [],
};

const ETIQUETAS_TRANSICION = {
  en_ruta: "Marcar en ruta",
  completado: "Marcar completado",
  anulado: "Anular despacho",
};

export const DispatchDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [despacho, setDespacho] = useState(null);
  const [pedidosAsignados, setPedidosAsignados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [confirmandoAnulacion, setConfirmandoAnulacion] = useState(false);

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
    if (id) cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const obtenerNombreCliente = (c) =>
    c?.razon_social || `${c?.primer_nombre || ""} ${c?.primer_apellido || ""}`;

  const getStatusBadge = (estado) => {
    const styles = {
      creado: "bg-blue-100 text-blue-800 border-blue-200",
      en_ruta: "bg-amber-100 text-amber-800 border-amber-200",
      completado: "bg-emerald-100 text-emerald-800 border-emerald-200",
      anulado: "bg-red-100 text-red-800 border-red-200",
    };
    const labels = {
      creado: "Creado",
      en_ruta: "En Ruta",
      completado: "Completado",
      anulado: "Anulado",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${styles[estado] || "bg-slate-100 text-slate-800 border-slate-200"}`}
      >
        {labels[estado] || estado}
      </span>
    );
  };

  const getEntregaBadge = (estadoEntrega) => {
    const styles = {
      pendiente: "bg-slate-100 text-slate-600 border-slate-200",
      entregado: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rechazado: "bg-red-100 text-red-800 border-red-200",
    };
    const labels = {
      pendiente: "Pendiente",
      entregado: "Entregado",
      rechazado: "Rechazado",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${styles[estadoEntrega] || styles.pendiente}`}
      >
        {labels[estadoEntrega] || estadoEntrega}
      </span>
    );
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    if (nuevoEstado === "anulado" && !confirmandoAnulacion) {
      setConfirmandoAnulacion(true);
      return;
    }

    setCambiandoEstado(true);
    setStatusError("");
    try {
      const actualizado = await dispatchService.actualizarEstadoDespacho(
        id,
        nuevoEstado,
      );
      setDespacho((prev) => ({ ...prev, estado: actualizado.estado }));
      setConfirmandoAnulacion(false);
    } catch (err) {
      setStatusError(err.message || "No se pudo actualizar el estado.");
    } finally {
      setCambiandoEstado(false);
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

  const transicionesDisponibles = TRANSICIONES_VALIDAS[despacho.estado] || [];

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
              {getStatusBadge(despacho.estado)}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" />{" "}
              {formatDate(despacho.fecha_despacho)}
            </p>
          </div>
        </div>

        {/* CONTROLES DE ESTADO */}
        {transicionesDisponibles.length > 0 && (
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {transicionesDisponibles.map((estadoDestino) => (
                <button
                  key={estadoDestino}
                  onClick={() => handleCambiarEstado(estadoDestino)}
                  disabled={cambiandoEstado}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                    estadoDestino === "anulado"
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {cambiandoEstado && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {estadoDestino === "anulado" && confirmandoAnulacion
                    ? "Confirmar anulación"
                    : ETIQUETAS_TRANSICION[estadoDestino]}
                </button>
              ))}
              {confirmandoAnulacion && (
                <button
                  onClick={() => setConfirmandoAnulacion(false)}
                  className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
            {statusError && (
              <p className="text-xs text-red-500 font-medium">{statusError}</p>
            )}
          </div>
        )}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                      Pedido #{item.pedido?.numero_pedido}
                    </h3>
                    {getEntregaBadge(item.estado_entrega)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {obtenerNombreCliente(item.pedido?.clientes)}
                  </p>
                  {item.notas_entrega && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      "{item.notas_entrega}"
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right pl-0 sm:pl-0">
                  <p className="text-base font-bold text-slate-900">
                    {formatCurrency(item.pedido?.total)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
