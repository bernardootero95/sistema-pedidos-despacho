import React, { useState, useEffect } from "react";
import { orderService } from "../services/orderService";
import {
  ShoppingCart,
  Search,
  PlusCircle,
  Eye,
  Ban,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const OrdersPage = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Estados para los modales (Los construiremos en los siguientes pasos)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [orderToView, setOrderToView] = useState(null);

  // Optimización de búsqueda (Debounce de 500ms) para no saturar la BD
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Resetear a la página 1 al buscar
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      const {
        data,
        total,
        totalPages: pages,
      } = await orderService.getPedidosPaginados(
        currentPage,
        pageSize,
        debouncedSearch,
      );
      setPedidos(data);
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch]);

  // Utilidades de formato
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    if (!motivo) return; // Si cancela o lo deja vacío, no hacemos nada

    try {
      // Optimistic Update
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, estado: "anulado", notas: motivo } : p,
        ),
      );
      await orderService.anularPedido(id, motivo);
    } catch (err) {
      alert("Error al anular: " + err.message);
      cargarPedidos(); // Revertir en caso de error
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            Gestión de Pedidos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualiza, busca y administra las órdenes de compra.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <PlusCircle className="h-5 w-5" />
          Nuevo Pedido
        </button>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="p-6 flex-1 flex flex-col min-h-0">
        {/* BARRA DE BÚSQUEDA */}
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número de pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            Total:{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span>
          </div>
        </div>

        {/* TABLA DE DATOS */}
        <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
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
                {loading && pedidos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        Cargando pedidos...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : pedidos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      No se encontraron pedidos.
                    </td>
                  </tr>
                ) : (
                  pedidos.map((pedido) => (
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
                          {pedido.clientes?.razon_social ||
                            `${pedido.clientes?.primer_nombre} ${pedido.clientes?.primer_apellido}`}
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
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setOrderToView(pedido)}
                            className="p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                            title="Ver Ficha Completa"
                          >
                            <Eye className="h-5 w-5" />
                          </button>

                          {pedido.estado !== "anulado" && (
                            <button
                              onClick={() =>
                                handleAnular(pedido.id, pedido.numero_pedido)
                              }
                              className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                              title="Anular Pedido"
                            >
                              <Ban className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
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
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AQUÍ IRÁN LOS MODALES: */}
      {/* {isFormOpen && <OrderForm ... />} */}
      {/* {orderToView && <OrderDetailsModal ... />} */}
    </div>
  );
};
