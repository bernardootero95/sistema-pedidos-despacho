import React from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import { useAuth } from "../../../context/AuthContext";
import {
  ShoppingCart,
  Truck,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

export const DashboardPage = () => {
  const { user } = useAuth();

  // Cálculos dinámicos desde DEMO_DATA para los KPIs
  const totalPedidos = DEMO_DATA.pedidos.length;
  const pedidosPendientes = DEMO_DATA.pedidos.filter(
    (p) => p.estado === "pendiente",
  ).length;
  const despachosActivos = DEMO_DATA.despachos.filter(
    (d) => d.estado === "en_ruta",
  ).length;

  const ventasTotales = DEMO_DATA.pedidos.reduce(
    (acc, pedido) => acc + pedido.total,
    0,
  );

  // Formateador de moneda colombiana / genérica para marca blanca
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case "pendiente":
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        );
      case "despachado":
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
            <Truck className="w-3 h-3" /> Despachado
          </span>
        );
      case "entregado":
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Entregado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* MENSAJE DE BIENVENIDA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            ¡Hola, {user?.nombre_completo}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Estás operando bajo el rol de{" "}
            <strong className="text-primary uppercase">{user?.rol}</strong> en
            el sistema logística.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            Empresa activa: <strong>{DEMO_DATA.empresa.nombre}</strong>
          </span>
        </div>
      </div>

      {/* TARJETAS DE INDICADORES (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ventas Totales
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrency(ventasTotales)}
            </h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Pedidos
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {totalPedidos}
            </h3>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Por Despachar
            </p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              {pedidosPendientes}
            </h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rutas Activas
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {despachosActivos}
            </h3>
          </div>
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TABLA DE ÚLTIMOS PEDIDOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              Últimos Pedidos Registrados
            </h3>
            <p className="text-xs text-slate-500">
              Monitoreo en tiempo real de las órdenes ingresadas
            </p>
          </div>
          <span className="text-xs font-semibold text-primary bg-primary-light px-3 py-1 rounded-full">
            {totalPedidos} en total
          </span>
        </div>

        <div className="overflow-x-auto">
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
              {DEMO_DATA.pedidos.map((pedido) => (
                <tr
                  key={pedido.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {pedido.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">
                    {pedido.cliente_nombre}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {pedido.vendedor_nombre}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {pedido.fecha}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {formatCurrency(pedido.total)}
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(pedido.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
