import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Package,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { orderService } from "../services/orderService";
import html2pdf from "html2pdf.js";

export const OrderDetailsModal = ({ orderId, onClose }) => {
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Cálculo discriminado exacto con blindaje para datos antiguos o con decimales
  const calcularDesgloseFiscal = () => {
    if (!pedido || !pedido.detalles)
      return { subtotal: 0, iva19: 0, iva5: 0, inc8: 0 };

    let subtotalGeneral = 0;
    let acumIva19 = 0;
    let acumIva5 = 0;
    let acumInc8 = 0;

    pedido.detalles.forEach((item) => {
      const subtotalLinea = Number(item.subtotal_linea) || 0;

      // 1. Extraer porcentajes (buscando en el detalle o en el producto cruzado)
      let porcIva = 0;
      if (item.iva_porcentaje !== undefined && item.iva_porcentaje !== null) {
        porcIva = Number(item.iva_porcentaje);
      } else if (item.producto && item.producto.iva !== undefined) {
        porcIva = Number(item.producto.iva);
      }

      let porcInc = 0;
      if (item.inc_porcentaje !== undefined && item.inc_porcentaje !== null) {
        porcInc = Number(item.inc_porcentaje);
      } else if (item.producto && item.producto.inc !== undefined) {
        porcInc = Number(item.producto.inc);
      }

      // 2. Redondear por si hay datos de prueba viejos (ej: 18.98 -> 19)
      const ivaRedondeado = Math.round(porcIva);
      const incRedondeado = Math.round(porcInc);

      // 3. Base gravable matemática exacta usando los valores redondeados
      const factor = 1 + (ivaRedondeado + incRedondeado) / 100;
      const baseLinea = subtotalLinea / factor;

      subtotalGeneral += baseLinea;

      // 4. Acumular en las categorías fijas
      if (ivaRedondeado === 19) {
        acumIva19 += baseLinea * (19 / 100);
      } else if (ivaRedondeado === 5) {
        acumIva5 += baseLinea * (5 / 100);
      }

      if (incRedondeado === 8) {
        acumInc8 += baseLinea * (8 / 100);
      }
    });

    return {
      subtotal: subtotalGeneral,
      iva19: acumIva19,
      iva5: acumIva5,
      inc8: acumInc8,
    };
  };

  const { subtotal, iva19, iva5, inc8 } = calcularDesgloseFiscal();

  const handleDownloadPdf = () => {
    const element = document.getElementById("ticket-pdf-content");
    const opt = {
      margin: 0,
      filename: `comprobante-pedido-${pedido?.numero_pedido || "recibo"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" },
    };

    setIsGeneratingPdf(true);
    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .finally(() => {
        setIsGeneratingPdf(false);
      });
  };

  const obtenerNombreCliente = (c) =>
    c?.razon_social || `${c?.primer_nombre || ""} ${c?.primer_apellido || ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden relative">
        {/* HEADER DE CONTROL */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Detalle del Pedido #{pedido?.numero_pedido}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || !pedido}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PDF 80mm
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-1.5 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR VISUALIZACIÓN */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p>Cargando detalle...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : pedido ? (
            <div
              id="ticket-pdf-content"
              className="bg-white w-[72mm] p-3 text-slate-900 text-[11px] font-mono flex flex-col gap-2.5 shadow-md"
            >
              {/* ENCABEZADO */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <h3 className="font-bold text-sm uppercase tracking-wide">
                  TECNOINGENIERÍA B.O.
                </h3>
                <p className="font-bold text-xs uppercase mt-0.5">
                  COMPROBANTE DE DESPACHO
                </p>
                <p className="font-bold mt-1 text-sm">
                  Pedido N°: {pedido.numero_pedido}
                </p>
                <p className="text-[10px] text-slate-600">
                  Fecha: {formatDate(pedido.fecha_pedido)}
                </p>
              </div>

              {/* DATOS DEL CLIENTE */}
              <div className="border-b border-dashed border-slate-400 pb-2 flex flex-col gap-0.5 text-[10px]">
                <p>
                  <span className="font-semibold">Cliente:</span>{" "}
                  {obtenerNombreCliente(pedido.clientes)}
                </p>
                <p>
                  <span className="font-semibold">Tipo ID:</span>{" "}
                  {pedido.clientes?.tipo_identificacion || "NIT / CC"}
                </p>
                <p>
                  <span className="font-semibold">N° Identificación:</span>{" "}
                  {pedido.clientes?.numero_identificacion}
                </p>
                <p>
                  <span className="font-semibold">Dirección:</span>{" "}
                  {pedido.clientes?.direccion || "No registrada"}
                </p>
                <p>
                  <span className="font-semibold">Vendedor:</span>{" "}
                  {pedido.vendedor?.nombre_completo}
                </p>
              </div>

              {/* PRODUCTOS */}
              <div className="border-b border-dashed border-slate-400 pb-2">
                <div className="grid grid-cols-12 font-bold border-b border-slate-300 pb-1 mb-1 text-[10px]">
                  <span className="col-span-2 text-center">CANT</span>
                  <span className="col-span-6">PRODUCTO</span>
                  <span className="col-span-4 text-right">TOTAL</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {pedido.detalles?.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col border-b border-slate-100 pb-1"
                    >
                      <div className="grid grid-cols-12 items-start text-[10px]">
                        <span className="col-span-2 text-center font-bold">
                          {item.cantidad}
                        </span>
                        <span className="col-span-6 font-medium">
                          {item.producto?.nombre}
                        </span>
                        <span className="col-span-4 text-right">
                          {formatCurrency(item.subtotal_linea)}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500 pl-2">
                        V. Unit: {formatCurrency(item.precio_unitario)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DISCRIMINACIÓN FINANCIERA FIJA */}
              <div className="border-b border-dashed border-slate-400 pb-2 flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>IVA 19%:</span>
                  <span>{formatCurrency(iva19)}</span>
                </div>

                <div className="flex justify-between">
                  <span>IVA 5%:</span>
                  <span>{formatCurrency(iva5)}</span>
                </div>

                <div className="flex justify-between">
                  <span>INC 8%:</span>
                  <span>{formatCurrency(inc8)}</span>
                </div>

                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-800 mt-1">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(pedido.total)}</span>
                </div>
              </div>

              {/* NOTAS */}
              {pedido.notas && (
                <div className="border-b border-dashed border-slate-400 pb-2 text-[10px]">
                  <span className="font-semibold block">Notas:</span>
                  <p className="italic">{pedido.notas}</p>
                </div>
              )}

              {/* PIE DE PÁGINA */}
              <div className="text-center text-[9px] text-slate-600 pt-1 flex flex-col gap-0.5">
                <p className="font-semibold">¡Gracias por su compra!</p>
                <p className="text-[8px] text-slate-500">
                  Sistema de pedidos y despacho desarrollado por TecnoIngeniería
                  B.O.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
