import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";
import { userService } from "../../users/services/userService";
import { imprimirPedidoPdf } from "../utils/printUtils";
import { useToast } from "../../../context/useToast";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import { useRealtimeSubscription } from "../../../hooks/useRealtimeSubscription";
import {
  ShoppingCart,
  Search,
  PlusCircle,
  Eye,
  Edit,
  Ban,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  X,
} from "lucide-react";

const ESTADOS_PEDIDO = ["pendiente", "en_ruta", "entregado", "anulado"];

export const OrdersPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();

  const {
    items: pedidos,
    setItems: setPedidos,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    filters: filtros,
    setFilters: setFiltros,
    reload: cargarPedidos,
  } = usePaginatedList((page, pageSize, search, filtrosActivos) =>
    orderService.getPedidosPaginados(page, pageSize, search, filtrosActivos),
  );
  const [printingId, setPrintingId] = useState(null);
  const [vendedores, setVendedores] = useState([]);

  // Si un vendedor crea un pedido o cambia de estado desde otra sesión,
  // esta lista se refresca sola en vez de esperar a que alguien recargue.
  useRealtimeSubscription("pedidos_cabecera", () => cargarPedidos());

  // Solo para poblar el select del filtro; no depende de la paginación.
  useEffect(() => {
    userService.getVendedores().then(setVendedores).catch(() => {});
  }, []);

  const handleFilterChange = (campo, valor) => {
    setFiltros({ ...filtros, [campo]: valor });
  };

  const limpiarFiltros = () => setFiltros({});

  const hayFiltrosActivos = Object.values(filtros).some(Boolean);

  // Query string con los filtros/búsqueda activos, para que el detalle del
  // pedido pueda navegar "siguiente/anterior" sobre el mismo subconjunto
  // que el usuario ve en la tabla.
  const buildFiltrosQueryString = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (filtros.estado) params.set("estado", filtros.estado);
    if (filtros.fechaDesde) params.set("desde", filtros.fechaDesde);
    if (filtros.fechaHasta) params.set("hasta", filtros.fechaHasta);
    if (filtros.vendedorId) params.set("vendedor", filtros.vendedorId);
    return params.toString();
  };

  const irADetalle = (pedidoId) => {
    const qs = buildFiltrosQueryString();
    navigate(`/orders/${pedidoId}${qs ? `?${qs}` : ""}`);
  };

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
    const styles = {
      pendiente: "bg-amber-100 text-amber-700 border-amber-200",
      en_ruta: "bg-blue-100 text-blue-700 border-blue-200",
      entregado: "bg-emerald-100 text-emerald-700 border-emerald-200",
      anulado: "bg-red-100 text-red-700 border-red-200",
    };
    const currentStyle =
      styles[estado?.toLowerCase()] ||
      "bg-slate-100 text-slate-700 border-slate-200";

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentStyle}`}
      >
        {estado?.charAt(0).toUpperCase() + estado?.slice(1).replace("_", " ")}
      </span>
    );
  };

  const handleAnular = async (id, numero_pedido) => {
    const motivo = window.prompt(
      `¿Indique el motivo para anular el pedido ${numero_pedido}?`,
    );
    if (!motivo) return;

    try {
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, estado: "anulado", notas: motivo } : p,
        ),
      );
      await orderService.anularPedido(id, motivo);
    } catch (err) {
      showError("Error al anular: " + err.message);
      cargarPedidos();
    }
  };

  const handleDirectPrint = async (id) => {
    try {
      setPrintingId(id);
      const pedidoCompleto = await orderService.getPedidoCompleto(id);
      await imprimirPedidoPdf(pedidoCompleto);
    } catch (err) {
      console.error("Error al generar PDF directo:", err);
      showError("No se pudo generar el comprobante del pedido.");
    } finally {
      setPrintingId(null);
    }
  };

  // Subcomponente para renderizar las acciones (botones) para no repetir código
  const ActionButtons = ({ pedido }) => (
    <div className="flex justify-center gap-1.5">
      <button
        onClick={() => handleDirectPrint(pedido.id)}
        disabled={printingId === pedido.id}
        className="p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors disabled:opacity-50"
        title="Imprimir Tiquete PDF"
      >
        {printingId === pedido.id ? (
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        ) : (
          <Printer className="h-5 w-5" />
        )}
      </button>

      <button
        onClick={() => irADetalle(pedido.id)}
        className="p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
        title="Ver Ficha Completa"
      >
        <Eye className="h-5 w-5" />
      </button>

      {pedido.estado === "pendiente" && (
        <button
          onClick={() => navigate(`/orders/${pedido.id}/editar`)}
          className="p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors"
          title="Editar Pedido"
        >
          <Edit className="h-5 w-5" />
        </button>
      )}

      {pedido.estado !== "anulado" && (
        <button
          onClick={() => handleAnular(pedido.id, pedido.numero_pedido)}
          className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          title="Anular Pedido"
        >
          <Ban className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 md:bg-slate-50">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            Gestión de Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visualiza, busca y administra las órdenes de compra.
          </p>
        </div>
        <button
          onClick={() => navigate("/orders/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <PlusCircle className="h-5 w-5" />
          Nuevo Pedido
        </button>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por número de pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <select
              value={filtros.estado || ""}
              onChange={(e) => handleFilterChange("estado", e.target.value)}
              className="w-full lg:w-auto px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 bg-white"
            >
              <option value="">Todos los estados</option>
              {ESTADOS_PEDIDO.map((estado) => (
                <option key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() +
                    estado.slice(1).replace("_", " ")}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 w-full lg:w-auto">
              <input
                type="date"
                aria-label="Fecha desde"
                value={filtros.fechaDesde || ""}
                onChange={(e) =>
                  handleFilterChange("fechaDesde", e.target.value)
                }
                className="w-full lg:w-auto px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700"
              />
              <span className="text-slate-400 text-sm">–</span>
              <input
                type="date"
                aria-label="Fecha hasta"
                value={filtros.fechaHasta || ""}
                onChange={(e) =>
                  handleFilterChange("fechaHasta", e.target.value)
                }
                className="w-full lg:w-auto px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700"
              />
            </div>

            <select
              value={filtros.vendedorId || ""}
              onChange={(e) =>
                handleFilterChange("vendedorId", e.target.value)
              }
              className="w-full lg:w-auto px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 bg-white"
            >
              <option value="">Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre_completo}
                </option>
              ))}
            </select>

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors shrink-0"
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
            )}

            <div className="text-sm text-slate-500 lg:ml-auto hidden sm:block whitespace-nowrap">
              Total:{" "}
              <span className="font-semibold text-slate-700">
                {totalItems}
              </span>
            </div>
          </div>
        </div>

        {/* ÁREA DE DATOS RESPONSIVA */}
        <div className="bg-transparent md:bg-white md:border md:border-slate-200 rounded-b-xl overflow-hidden flex-1 flex flex-col">
          {/* ESTADOS DE CARGA Y ERROR */}
          {loading && pedidos.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 flex-1 bg-white border border-t-0 border-slate-200">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Cargando pedidos...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 flex-1 bg-white border border-t-0 border-slate-200">
              Error: {error}
            </div>
          ) : pedidos.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex-1 bg-white border border-t-0 border-slate-200">
              No se encontraron pedidos.
            </div>
          ) : (
            <>
              {/* === VISTA MÓVIL (Tarjetas) === */}
              <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pt-4 pb-2">
                {pedidos.map((pedido) => (
                  <div
                    key={pedido.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 text-lg block leading-tight">
                          {pedido.numero_pedido}
                        </span>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(pedido.fecha_pedido)}
                        </div>
                      </div>
                      {getStatusBadge(pedido.estado)}
                    </div>

                    <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="font-semibold text-slate-700 flex items-start gap-2">
                        <User className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          {getNombreCliente(pedido.clientes)}
                          <div className="text-xs text-slate-500 font-normal mt-0.5">
                            ID: {pedido.clientes?.numero_identificacion}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500">Total</span>
                        <span className="font-bold text-slate-800 text-lg">
                          {formatCurrency(pedido.total)}
                        </span>
                      </div>
                      <ActionButtons pedido={pedido} />
                    </div>
                  </div>
                ))}
              </div>

              {/* === VISTA ESCRITORIO (Tabla Original) === */}
              <div className="hidden md:block overflow-x-auto flex-1 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
                      <th className="p-4 whitespace-nowrap">N° Pedido</th>
                      <th className="p-4 whitespace-nowrap">Fecha</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Vendedor</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {pedidos.map((pedido) => (
                      <tr
                        key={pedido.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="p-4 font-medium text-slate-800">
                          {pedido.numero_pedido}
                        </td>
                        <td className="p-4 text-slate-600">
                          {formatDate(pedido.fecha_pedido)}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-slate-800">
                            {getNombreCliente(pedido.clientes)}
                          </div>
                          <div className="text-xs text-slate-500">
                            ID: {pedido.clientes?.numero_identificacion}
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">
                          {pedido.vendedor?.nombre_completo}
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-800">
                          {formatCurrency(pedido.total)}
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(pedido.estado)}
                        </td>
                        <td className="p-4">
                          <ActionButtons pedido={pedido} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* CONTROLES DE PAGINACIÓN */}
          <div className="border-t border-slate-200 p-4 bg-white md:bg-slate-50 rounded-b-xl flex items-center justify-between mt-auto">
            <div className="text-sm text-slate-500">
              Página{" "}
              <span className="font-medium text-slate-700">{currentPage}</span>{" "}
              de{" "}
              <span className="font-medium text-slate-700">
                {totalPages || 1}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={
                  currentPage === totalPages || loading || totalPages === 0
                }
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
