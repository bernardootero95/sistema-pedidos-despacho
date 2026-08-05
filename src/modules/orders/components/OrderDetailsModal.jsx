import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Package,
  User,
  Calendar,
  FileText,
  Loader2,
  Tag,
  AlertCircle,
} from "lucide-react";
import { orderService } from "../services/orderService";

export const OrderDetailsModal = ({ orderId, onClose }) => {
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetalles = async () => {
      try {
        setLoading(true);
        const data = await orderService.getPedidoCompleto(orderId);
        setPedido(data);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la información del pedido.");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchDetalles();
    }
  }, [orderId]);

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
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (estado) => {
    const styles = {
      pendiente: "bg-amber-100 text-amber-800 border-amber-200",
      en_ruta: "bg-blue-100 text-blue-800 border-blue-200",
      entregado: "bg-emerald-100 text-emerald-800 border-emerald-200",
      anulado: "bg-red-100 text-red-800 border-red-200",
    };
    const currentStyle =
      styles[estado?.toLowerCase()] ||
      "bg-slate-100 text-slate-800 border-slate-200";
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold border ${currentStyle}`}
      >
        {estado?.charAt(0).toUpperCase() + estado?.slice(1).replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-6 w-6 text-blue-600" />
              Detalle del Pedido
            </h2>
            {pedido && (
              <p className="text-sm text-slate-500 mt-1 font-mono">
                {pedido.numero_pedido}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="text-slate-500 hover:bg-slate-200 hover:text-slate-800 p-2 rounded-lg transition-colors flex items-center gap-2"
              title="Imprimir (Ctrl+P)"
            >
              <Printer className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">
                Imprimir
              </span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-full transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-6 printable-area">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p>Cargando información del pedido...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-6 w-6" />
              <p>{error}</p>
            </div>
          ) : pedido ? (
            <div className="flex flex-col gap-6">
              {/* SECCIÓN 1: ESTADO Y METADATOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-1">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> Fecha del Pedido
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatDate(pedido.fecha_pedido)}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-1">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <User className="h-4 w-4" /> Vendedor
                  </span>
                  <span className="font-medium text-slate-800">
                    {pedido.vendedor?.nombre_completo}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-1 items-start justify-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                    <Tag className="h-4 w-4" /> Estado Actual
                  </span>
                  {getStatusBadge(pedido.estado)}
                </div>
              </div>

              {/* SECCIÓN 2: INFORMACIÓN DEL CLIENTE */}
              <div className="border border-slate-200 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="h-5 w-5 text-slate-400" />
                  Datos del Cliente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                  <div>
                    <span className="text-sm text-slate-500 block">
                      Razón Social / Nombre
                    </span>
                    <span className="font-medium text-slate-800">
                      {pedido.clientes?.razon_social ||
                        `${pedido.clientes?.primer_nombre} ${pedido.clientes?.primer_apellido}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500 block">
                      Identificación (NIT/CC)
                    </span>
                    <span className="font-medium text-slate-800">
                      {pedido.clientes?.numero_identificacion}
                    </span>
                  </div>
                  {pedido.clientes?.email && (
                    <div>
                      <span className="text-sm text-slate-500 block">
                        Correo Electrónico
                      </span>
                      <span className="font-medium text-slate-800">
                        {pedido.clientes?.email}
                      </span>
                    </div>
                  )}
                  {pedido.clientes?.telefono && (
                    <div>
                      <span className="text-sm text-slate-500 block">
                        Teléfono
                      </span>
                      <span className="font-medium text-slate-800">
                        {pedido.clientes?.telefono}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: DETALLE DE PRODUCTOS */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">
                  Productos Solicitados
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th className="p-3 w-16 text-center">Cant.</th>
                        <th className="p-3">Código</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 text-right">V. Unitario</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pedido.detalles?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 text-center font-medium">
                            {item.cantidad}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-xs">
                            {item.producto?.codigo}
                          </td>
                          <td className="p-3 font-medium text-slate-800">
                            {item.producto?.nombre}
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {formatCurrency(item.precio_unitario)}
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-800">
                            {formatCurrency(item.subtotal_linea)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECCIÓN 4: NOTAS Y TOTAL */}
              <div className="flex flex-col md:flex-row gap-6 mt-2">
                <div className="flex-1 bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
                    <FileText className="h-4 w-4" /> Notas / Observaciones
                  </h4>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                    {pedido.notas ||
                      "Sin observaciones adicionales registradas en este pedido."}
                  </p>
                </div>
                <div className="w-full md:w-72 bg-slate-800 text-white p-6 rounded-xl flex flex-col justify-center items-end shadow-inner">
                  <span className="text-slate-300 text-sm mb-1 uppercase tracking-wider font-semibold">
                    Total del Pedido
                  </span>
                  <span className="text-3xl font-bold text-emerald-400">
                    {formatCurrency(pedido.total)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
