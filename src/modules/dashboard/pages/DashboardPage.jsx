import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { tenantConfig } from "../../../config/tenant";
import { dashboardService } from "../services/dashboardService";
import { userService } from "../../users/services/userService";
import { DashboardKpiCard } from "../components/DashboardKpiCard";
import { DailySalesChart } from "../components/DailySalesChart";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { SalesReportSummary } from "../../reports/components/SalesReportSummary";
import { normalizarResumenVentas } from "../../reports/utils/salesReportFormat";
import { obtenerCategoriasDetalle } from "../../reports/utils/salesReportPeriod";
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  PackageX,
  PlusCircle,
  Users,
} from "lucide-react";

const RESUMEN_INICIAL = {
  hoy: normalizarResumenVentas(),
  mes: normalizarResumenVentas(),
  pedidosPendientes: 0,
  pedidosDespachados: 0,
  despachosActivos: 0,
};

// Etiquetas de pendientes ("del día" / "del mes"): las mismas del informe
// de ventas, para que ambas pantallas hablen igual.
const CATEGORIAS_HOY = obtenerCategoriasDetalle("diario");
const CATEGORIAS_MES = obtenerCategoriasDetalle("mensual");

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // vendedor y cajera solo ven sus propios pedidos (RLS) y no manejan
  // rutas/despachos: mismo recorte de UI para ambos.
  const esVendedor = ["vendedor", "cajera"].includes(user?.rol);
  // soporte/gerencia ven la bodega completa y pueden acotar por vendedor;
  // despachador/repartidor ven la bodega completa pero solo el valor
  // global (sin filtro); vendedor ve solo lo suyo vía RLS.
  const puedeFiltrarPorVendedor = ["gerencia", "soporte"].includes(user?.rol);

  const [resumen, setResumen] = useState(RESUMEN_INICIAL);
  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Solo para poblar el select del filtro; no depende de la recarga del panel.
  useEffect(() => {
    if (!puedeFiltrarPorVendedor) return;
    userService.getVendedores().then(setVendedores).catch(() => {});
  }, [puedeFiltrarPorVendedor]);

  useEffect(() => {
    const filtroActivo = puedeFiltrarPorVendedor ? vendedorFiltro : undefined;

    const cargarDashboard = async () => {
      try {
        setLoading(true);
        setError("");
        const [resumenData, pedidosData, ventasDiariasData] = await Promise.all([
          dashboardService.obtenerResumen(filtroActivo),
          dashboardService.obtenerUltimosPedidos(3, filtroActivo),
          dashboardService.obtenerVentasDiarias(filtroActivo),
        ]);
        setResumen(resumenData);
        setUltimosPedidos(pedidosData);
        setVentasDiarias(ventasDiariasData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    cargarDashboard();
  }, [puedeFiltrarPorVendedor, vendedorFiltro]);

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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {esVendedor && (
            <button
              onClick={() => navigate("/orders/new")}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              Nuevo Pedido
            </button>
          )}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium">
            <AlertCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">
              Empresa: <strong>{tenantConfig.name}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* FILTRO POR VENDEDOR (solo gerencia/soporte) */}
      {puedeFiltrarPorVendedor && (
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Users className="w-4 h-4 text-slate-400 shrink-0" />
          <label htmlFor="filtro-vendedor" className="text-sm font-medium text-slate-600 shrink-0">
            Ver estadísticas de:
          </label>
          <select
            id="filtro-vendedor"
            value={vendedorFiltro}
            onChange={(e) => setVendedorFiltro(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 bg-white"
          >
            <option value="">Toda la bodega</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre_completo}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* RESUMEN DE VENTAS: mismos conceptos que el informe de ventas
          (preventa por fecha de pedido, ventas por fecha de entrega,
          anulados/devueltos y pendientes del período vs. anteriores). */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
          Hoy
        </h2>
        <SalesReportSummary resumen={resumen.hoy} categorias={CATEGORIAS_HOY} />
      </div>

      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
          Este mes
        </h2>
        <SalesReportSummary resumen={resumen.mes} categorias={CATEGORIAS_MES} />
      </div>

      {/* OPERACIÓN EN CURSO: foto actual, sin período. Un vendedor no
          despacha ni tiene rutas: no ve las rutas activas de la empresa. */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
          Operación en curso
        </h2>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${esVendedor ? "" : "lg:grid-cols-3"}`}>
          <DashboardKpiCard
            label="Por despachar"
            value={resumen.pedidosPendientes}
            icon={Clock}
            color="amber"
            valueClassName="text-amber-600"
          />
          <DashboardKpiCard
            label="En ruta"
            value={resumen.pedidosDespachados}
            icon={Truck}
            color="purple"
          />
          {!esVendedor && (
            <DashboardKpiCard
              label="Rutas Activas"
              value={resumen.despachosActivos}
              icon={Truck}
              color="slate"
            />
          )}
        </div>
      </div>

      {/* VENTAS DIARIAS (últimos 30 días) */}
      <DailySalesChart datos={ventasDiarias} formatCurrency={formatCurrency} />

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
                    {getNombreCliente(pedido.clientes)}
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
                        {getNombreCliente(pedido.clientes)}
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
