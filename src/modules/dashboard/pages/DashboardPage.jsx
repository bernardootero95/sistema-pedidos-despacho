import { useState, useEffect } from "react";
import { useAuth } from "../../../context/useAuth";
import { tenantConfig } from "../../../config/tenant";
import { dashboardService } from "../services/dashboardService";
import { DashboardKpiCard } from "../components/DashboardKpiCard";
import {
  ShoppingCart,
  Truck,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  PackageX,
} from "lucide-react";

export const DashboardPage = () => {
  const { user } = useAuth();

  const [resumen, setResumen] = useState({
    ventasTotales: 0,
    totalPedidos: 0,
    pedidosPendientes: 0,
    despachosActivos: 0,
  });
  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        setLoading(true);
        setError("");
        const [resumenData, pedidosData] = await Promise.all([
          dashboardService.obtenerResumen(),
          dashboardService.obtenerUltimosPedidos(),
        ]);
        setResumen(resumenData);
        setUltimosPedidos(pedidosData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    cargarDashboard();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getClienteNombre = (clientes) =>
    clientes?.razon_social ||
    `${clientes?.primer_nombre || ""} ${clientes?.primer_apellido || ""}`;

  const getStatusBadge = (estado) => {
    switch (estado) {
      case "pendiente":
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 shrink-0" /> Pendiente
          </span>
        );
      case "despachado":
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center gap-1 w-fit">
            <Truck className="w-3 h-3 shrink-0" /> Despachado
          </span>
        );
      case "entregado":
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 shrink-0" /> Entregado
          </span>
        );
      case "anulado":
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold inline-flex items-center gap-1 w-fit">
            <PackageX className="w-3 h-3 shrink-0" /> Anulado
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-500 p-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        Cargando panel...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl border border-red-200 text-red-600 text-sm">
        Error al cargar el panel: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* MENSAJE DE BIENVENIDA */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            ¡Hola, {user?.nombre_completo}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Estás operando bajo el rol de{" "}
            <strong className="text-primary uppercase">{user?.rol}</strong> en
            el sistema logística.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">
            Empresa: <strong>{tenantConfig.name}</strong>
          </span>
        </div>
      </div>

      {/* TARJETAS DE INDICADORES (KPIs) - Adaptables a móvil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardKpiCard
          label="Ventas Totales"
          value={formatCurrency(resumen.ventasTotales)}
          icon={DollarSign}
          color="emerald"
        />
        <DashboardKpiCard
          label="Total Pedidos"
          value={resumen.totalPedidos}
          icon={ShoppingCart}
          color="blue"
        />
        <DashboardKpiCard
          label="Por Despachar"
          value={resumen.pedidosPendientes}
          icon={Clock}
          color="amber"
          valueClassName="text-amber-600"
        />
        <DashboardKpiCard
          label="Rutas Activas"
          value={resumen.despachosActivos}
          icon={Truck}
          color="purple"
        />
      </div>

      {/* ÚLTIMOS PEDIDOS REGISTRADOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Últimos Pedidos Registrados
            </h3>
            <p className="text-xs text-slate-500">
              Monitoreo en tiempo real de las órdenes ingresadas
            </p>
          </div>
          <span className="text-xs font-semibold text-primary bg-primary-light px-3 py-1 rounded-full shrink-0">
            {ultimosPedidos.length} recientes
          </span>
        </div>

        {ultimosPedidos.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Aún no hay pedidos registrados.
          </div>
        ) : (
          <>
            {/* VISTA MÓVIL (TARJETAS) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {ultimosPedidos.map((pedido) => (
                <div key={pedido.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {pedido.numero_pedido}
                    </span>
                    {getStatusBadge(pedido.estado)}
                  </div>
                  <p className="font-bold text-slate-800 text-sm">
                    {getClienteNombre(pedido.clientes)}
                  </p>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">
                      Vendedor: {pedido.vendedor?.nombre_completo}
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {formatCurrency(pedido.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* VISTA ESCRITORIO (TABLA) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">ID Pedido</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Vendedor Asignado</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {ultimosPedidos.map((pedido) => (
                    <tr
                      key={pedido.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {pedido.numero_pedido}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {getClienteNombre(pedido.clientes)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {pedido.vendedor?.nombre_completo}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {formatDate(pedido.fecha_pedido)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatCurrency(pedido.total)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(pedido.estado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
