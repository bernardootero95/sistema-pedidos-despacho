import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";
import { OrderDetailsModal } from "../components/OrderDetailsModal";
import html2pdf from "html2pdf.js/dist/html2pdf.min.js";
import {
  ShoppingCart,
  Search,
  PlusCircle,
  Eye,
  Ban,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const OrdersPage = () => {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printingId, setPrintingId] = useState(null);

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Estados para el modal de detalle y contenido de impresión directa
  const [orderToView, setOrderToView] = useState(null);
  const [pedidoParaImprimir, setPedidoParaImprimir] = useState(null);

  // Nombre de empresa desde variables de entorno
  const companyName = import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
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
    if (!motivo) return;

    try {
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, estado: "anulado", notas: motivo } : p,
        ),
      );
      await orderService.anularPedido(id, motivo);
    } catch (err) {
      alert("Error al anular: " + err.message);
      cargarPedidos();
    }
  };

  // Impresión directa usando el contenedor DOM real
  const handleDirectPrint = async (id) => {
    try {
      setPrintingId(id);
      const pedidoCompleto = await orderService.getPedidoCompleto(id);
      setPedidoParaImprimir(pedidoCompleto);

      // Damos un pequeño respiro al ciclo de vida de React para que el DOM pinte el contenedor oculto
      setTimeout(async () => {
        const element = document.getElementById("direct-print-ticket");
        if (!element) {
          alert("No se pudo renderizar el tiquete.");
          setPrintingId(null);
          return;
        }

        const opt = {
          margin: 0,
          filename: `comprobante-pedido-${pedidoCompleto.numero_pedido}.pdf`,
          image: { type: "jpeg", quality: 1 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" },
        };

        await html2pdf()
          .set(opt)
          .from(element)
          .output("bloburl")
          .then((pdfUrl) => {
            window.open(pdfUrl, "_blank");
          });

        setPedidoParaImprimir(null);
        setPrintingId(null);
      }, 300);
    } catch (err) {
      console.error("Error al generar PDF directo:", err);
      alert("No se pudo generar el comprobante del pedido.");
      setPrintingId(null);
      setPedidoParaImprimir(null);
    }
  };

  // Cálculos fiscales para el tiquete de impresión directa
  const calcularDesgloseDirecto = (detalles) => {
    if (!detalles) return { subtotal: 0, iva19: 0, iva5: 0, inc8: 0 };
    let subtotalGeneral = 0;
    let acumIva19 = 0;
    let acumIva5 = 0;
    let acumInc8 = 0;

    detalles.forEach((item) => {
      const subtotalLinea = Number(item.subtotal_linea) || 0;
      const porcIva = Math.round(Number(item.iva_porcentaje) || 0);
      const porcInc = Math.round(Number(item.inc_porcentaje) || 0);

      const factor = 1 + (porcIva + porcInc) / 100;
      const baseLinea = subtotalLinea / factor;

      subtotalGeneral += baseLinea;

      if (porcIva === 19) acumIva19 += baseLinea * (19 / 100);
      else if (porcIva === 5) acumIva5 += baseLinea * (5 / 100);
      if (porcInc === 8) acumInc8 += baseLinea * (8 / 100);
    });

    return {
      subtotal: subtotalGeneral,
      iva19: acumIva19,
      iva5: acumIva5,
      inc8: acumInc8,
    };
  };

  const totalesDirectos = pedidoParaImprimir
    ? calcularDesgloseDirecto(pedidoParaImprimir.detalles)
    : { subtotal: 0, iva19: 0, iva5: 0, inc8: 0 };
  const clienteNombreDirecto =
    pedidoParaImprimir?.clientes?.razon_social ||
    `${pedidoParaImprimir?.clientes?.primer_nombre || ""} ${pedidoParaImprimir?.clientes?.primer_apellido || ""}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
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
          onClick={() => navigate("/orders/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <PlusCircle className="h-5 w-5" />
          Nuevo Pedido
        </button>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="p-6 flex-1 flex flex-col min-h-0">
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
                            `${pedido.clientes?.primer_nombre || ""} ${pedido.clientes?.primer_apellido || ""}`}
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
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleDirectPrint(pedido.id)}
                            disabled={printingId === pedido.id}
                            className="p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                            title="Imprimir / Abrir Tiquete PDF"
                          >
                            {printingId === pedido.id ? (
                              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                            ) : (
                              <Printer className="h-5 w-5" />
                            )}
                          </button>

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

      {/* CONTENEDOR OCULTO EN EL DOM REAL PARA RENDERIZAR EL TIQUETE ANTES DE EXPORTAR A PDF */}
      {pedidoParaImprimir && (
        <div
          style={{ position: "absolute", left: "-9999px", top: 0, zIndex: -50 }}
        >
          <div
            id="direct-print-ticket"
            style={{
              backgroundColor: "#ffffff",
              color: "#000000",
              width: "72mm",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: "11px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                paddingBottom: "8px",
                borderBottom: "1px dashed #000000",
              }}
            >
              <h3
                style={{
                  fontWeight: "bold",
                  fontSize: "14px",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {companyName}
              </h3>
              <p
                style={{
                  fontWeight: "bold",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  margin: "2px 0",
                }}
              >
                COMPROBANTE DE DESPACHO
              </p>
              <p
                style={{
                  fontWeight: "bold",
                  fontSize: "13px",
                  margin: "4px 0",
                }}
              >
                Pedido N°: {pedidoParaImprimir.numero_pedido}
              </p>
              <p style={{ fontSize: "10px", color: "#333333", margin: 0 }}>
                Fecha: {formatDate(pedidoParaImprimir.fecha_pedido)}
              </p>
            </div>

            <div
              style={{
                paddingBottom: "8px",
                borderBottom: "1px dashed #000000",
                fontSize: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Cliente:</strong> {clienteNombreDirecto}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Tipo ID:</strong>{" "}
                {pedidoParaImprimir.clientes?.tipo_identificacion || "NIT / CC"}
              </p>
              <p style={{ margin: 0 }}>
                <strong>N° Identificación:</strong>{" "}
                {pedidoParaImprimir.clientes?.numero_identificacion}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Dirección:</strong>{" "}
                {pedidoParaImprimir.clientes?.direccion || "No registrada"}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Vendedor:</strong>{" "}
                {pedidoParaImprimir.vendedor?.nombre_completo}
              </p>
            </div>

            <div
              style={{
                paddingBottom: "8px",
                borderBottom: "1px dashed #000000",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                  fontWeight: "bold",
                  borderBottom: "1px solid #000000",
                  paddingBottom: "4px",
                  marginBottom: "4px",
                  fontSize: "10px",
                }}
              >
                <span
                  style={{ gridColumn: "span 2 / span 2", textAlign: "center" }}
                >
                  CANT
                </span>
                <span style={{ gridColumn: "span 6 / span 6" }}>PRODUCTO</span>
                <span
                  style={{ gridColumn: "span 4 / span 4", textAlign: "right" }}
                >
                  TOTAL
                </span>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {pedidoParaImprimir.detalles?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderBottom: "1px solid #eeeeee",
                      paddingBottom: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                        fontSize: "10px",
                      }}
                    >
                      <span
                        style={{
                          gridColumn: "span 2 / span 2",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {item.cantidad}
                      </span>
                      <span
                        style={{
                          gridColumn: "span 6 / span 6",
                          fontWeight: "500",
                        }}
                      >
                        {item.producto?.nombre}
                      </span>
                      <span
                        style={{
                          gridColumn: "span 4 / span 4",
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(item.subtotal_linea)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        paddingLeft: "8px",
                        color: "#555555",
                      }}
                    >
                      V. Unit: {formatCurrency(item.precio_unitario)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                paddingBottom: "8px",
                borderBottom: "1px dashed #000000",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>SUBTOTAL:</span>
                <span>{formatCurrency(totalesDirectos.subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>IVA 19%:</span>
                <span>{formatCurrency(totalesDirectos.iva19)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>IVA 5%:</span>
                <span>{formatCurrency(totalesDirectos.iva5)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>INC 8%:</span>
                <span>{formatCurrency(totalesDirectos.inc8)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                  fontSize: "12px",
                  borderTop: "1px solid #000000",
                  paddingTop: "4px",
                  marginTop: "2px",
                }}
              >
                <span>TOTAL:</span>
                <span>{formatCurrency(pedidoParaImprimir.total)}</span>
              </div>
            </div>

            {pedidoParaImprimir.notas && (
              <div
                style={{
                  paddingBottom: "8px",
                  borderBottom: "1px dashed #000000",
                  fontSize: "10px",
                }}
              >
                <strong style={{ display: "block" }}>Notas:</strong>
                <p style={{ margin: 0, fontStyle: "italic" }}>
                  {pedidoParaImprimir.notas}
                </p>
              </div>
            )}

            <div
              style={{
                textAlign: "center",
                fontSize: "9px",
                color: "#333333",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <p style={{ fontWeight: "bold", color: "#000000", margin: 0 }}>
                ¡Gracias por su compra!
              </p>
              <p style={{ fontSize: "8px", margin: 0 }}>
                Sistema de pedidos y despacho desarrollado por TecnoIngenieria
                B.O.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES */}
      {orderToView && (
        <OrderDetailsModal
          orderId={orderToView.id}
          onClose={() => setOrderToView(null)}
        />
      )}
    </div>
  );
};
