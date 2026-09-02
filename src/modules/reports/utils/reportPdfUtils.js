// src/modules/reports/utils/reportPdfUtils.js
import { generarPdfBlobUrl, formatCurrencyPdf } from "../../orders/utils/printUtils";

const formatFechaCorta = (fechaISO) =>
  fechaISO ? new Date(`${fechaISO}T00:00:00`).toLocaleDateString("es-CO") : "";

const ETIQUETAS_CAMPO_FECHA = {
  fecha_pedido: "Fecha de pedido",
  fecha_entrega: "Fecha de entrega",
};

/**
 * Arma el HTML tabular (A4) del informe de productos: encabezado con los
 * filtros aplicados, tabla de resultados y fila de totales. A diferencia de
 * construirComprobantePedidoHtml (recibo térmico 80mm de un solo pedido),
 * esto es un listado — usa generarPdfBlobUrl con formato "a4" en vez del
 * formato térmico.
 *
 * @param {Array<{codigo: string, nombre: string, cantidad_total: number, monto_total: number, pedidos_count: number}>} filas
 * @param {{ fechaDesde: string, fechaHasta: string, campoFecha: string, estadoLabel?: string, vendedorLabel?: string, clienteLabel?: string }} filtros
 */
const construirInformeProductosHtml = (filas, filtros) => {
  const companyName = import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";
  const totalCantidad = filas.reduce((acc, f) => acc + f.cantidad_total, 0);
  const totalMonto = filas.reduce((acc, f) => acc + f.monto_total, 0);

  return `
    <div style="background-color: #ffffff; color: #000000; width: 190mm; padding: 10mm; font-family: Arial, sans-serif; font-size: 11px;">
      <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 8px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; text-transform: uppercase;">${companyName}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; font-weight: bold;">Informe de Productos por Pedido</p>
      </div>

      <div style="margin-bottom: 12px; font-size: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <div><strong>${ETIQUETAS_CAMPO_FECHA[filtros.campoFecha] || "Fecha"}:</strong> ${formatFechaCorta(filtros.fechaDesde)} — ${formatFechaCorta(filtros.fechaHasta)}</div>
        <div><strong>Estado:</strong> ${filtros.estadoLabel || "Todos"}</div>
        <div><strong>Vendedor:</strong> ${filtros.vendedorLabel || "Todos"}</div>
        <div><strong>Cliente:</strong> ${filtros.clienteLabel || "Todos"}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #000000;">
            <th style="text-align: left; padding: 6px;">Código</th>
            <th style="text-align: left; padding: 6px;">Producto</th>
            <th style="text-align: right; padding: 6px;">Cantidad</th>
            <th style="text-align: right; padding: 6px;">Valor total</th>
            <th style="text-align: right; padding: 6px;"># Pedidos</th>
          </tr>
        </thead>
        <tbody>
          ${filas
            .map(
              (fila) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 5px;">${fila.codigo}</td>
              <td style="padding: 5px;">${fila.nombre}</td>
              <td style="padding: 5px; text-align: right;">${fila.cantidad_total}</td>
              <td style="padding: 5px; text-align: right;">${formatCurrencyPdf(fila.monto_total)}</td>
              <td style="padding: 5px; text-align: right;">${fila.pedidos_count}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr style="border-top: 2px solid #000000; font-weight: bold;">
            <td style="padding: 6px;" colspan="2">TOTAL</td>
            <td style="padding: 6px; text-align: right;">${totalCantidad}</td>
            <td style="padding: 6px; text-align: right;">${formatCurrencyPdf(totalMonto)}</td>
            <td style="padding: 6px;"></td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top: 16px; font-size: 9px; color: #475569;">
        Generado el ${new Date().toLocaleString("es-CO")}
      </p>
    </div>
  `;
};

export const exportarInformeProductosPdf = async (filas, filtros) => {
  const html = construirInformeProductosHtml(filas, filtros);
  const pdfUrl = await generarPdfBlobUrl(html, `informe-productos-${filtros.fechaDesde}-a-${filtros.fechaHasta}.pdf`, {
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  });
  window.open(pdfUrl, "_blank");
};
