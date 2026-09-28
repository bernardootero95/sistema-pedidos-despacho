// src/modules/reports/utils/salesReportPdfUtils.js
import { generarPdfBlobUrl } from "../../orders/utils/printUtils";
import { formatFechaHora, formatMoneda, etiquetaEstado } from "./salesReportFormat";

/**
 * Exportadores PDF del informe de ventas en dos formatos:
 *   - carta:   hoja tamaño carta con resumen + detalle de pedidos por categoría.
 *   - tiquete: impresora térmica 80mm, solo el resumen (para cuadre de caja).
 *
 * El HTML se arma como string (igual que construirComprobantePedidoHtml) y
 * los textos que vienen de la base (cliente, vendedor) se escapan antes de
 * interpolarlos: el fragmento se inyecta con innerHTML en generarPdfBlobUrl.
 *
 * @typedef {Object} InformeVentasPdf
 * @property {string} titulo
 * @property {string} periodo            Texto legible del período
 * @property {string} [vendedorLabel]
 * @property {Array<{clave: string, resumen: string, label: string}>} categorias
 * @property {Record<string, {cantidad: number, monto: number}>} resumen
 * @property {Array<Object>} detalle
 * @property {string} nombreArchivo      Sin extensión
 */

const escaparHtml = (texto) =>
  String(texto ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const nombreEmpresa = () => escaparHtml(import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS");

/** Filas del resumen en el orden en que se imprimen (preventa primero). */
const filasResumen = ({ resumen, categorias }) => [
  { label: "Total pedidos (preventa)", ...resumen.preventa, destacado: true },
  ...categorias.map((c) => ({
    label: c.clave === "venta" ? "Total ventas (entregados)" : c.label,
    ...resumen[c.resumen],
    destacado: c.clave === "venta",
  })),
];

// ----------------------------------------------------------------------------
// Carta
// ----------------------------------------------------------------------------

const construirTablaCategoriaHtml = (categoria, pedidos) => {
  const total = pedidos.reduce((acc, p) => acc + p.total, 0);
  const filas = pedidos
    .map(
      (p) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 4px;">${escaparHtml(p.numero_pedido)}</td>
        <td style="padding: 4px; white-space: nowrap;">${formatFechaHora(p.fecha_pedido)}</td>
        <td style="padding: 4px; white-space: nowrap;">${formatFechaHora(p.fecha_entrega)}</td>
        <td style="padding: 4px;">${escaparHtml(p.cliente)}</td>
        <td style="padding: 4px;">${escaparHtml(p.vendedor || "—")}</td>
        <td style="padding: 4px;">${etiquetaEstado(p.estado)}</td>
        <td style="padding: 4px; text-align: right; white-space: nowrap;">${formatMoneda(p.total)}</td>
      </tr>`,
    )
    .join("");

  return `
    <h3 style="font-size: 12px; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #000000;">
      ${categoria.label} (${pedidos.length})
    </h3>
    ${
      pedidos.length === 0
        ? `<p style="font-size: 10px; color: #475569; margin: 0;">Sin pedidos.</p>`
        : `<table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #000000;">
            <th style="text-align: left; padding: 4px;">N° pedido</th>
            <th style="text-align: left; padding: 4px;">Fecha pedido</th>
            <th style="text-align: left; padding: 4px;">Fecha entrega</th>
            <th style="text-align: left; padding: 4px;">Cliente</th>
            <th style="text-align: left; padding: 4px;">Vendedor</th>
            <th style="text-align: left; padding: 4px;">Estado</th>
            <th style="text-align: right; padding: 4px;">Total</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr style="border-top: 2px solid #000000; font-weight: bold;">
            <td style="padding: 4px;" colspan="6">TOTAL</td>
            <td style="padding: 4px; text-align: right; white-space: nowrap;">${formatMoneda(total)}</td>
          </tr>
        </tfoot>
      </table>`
    }
  `;
};

/** @param {InformeVentasPdf} informe */
export const construirInformeVentasCartaHtml = (informe) => {
  const filasResumenHtml = filasResumen(informe)
    .map(
      (f) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${f.destacado ? "font-weight: bold;" : ""}">
        <td style="padding: 5px;">${f.label}</td>
        <td style="padding: 5px; text-align: right;">${f.cantidad}</td>
        <td style="padding: 5px; text-align: right;">${formatMoneda(f.monto)}</td>
      </tr>`,
    )
    .join("");

  const detalleHtml = informe.categorias
    .map((c) =>
      construirTablaCategoriaHtml(
        c,
        informe.detalle.filter((p) => p.categoria === c.clave),
      ),
    )
    .join("");

  return `
    <div style="background-color: #ffffff; color: #000000; width: 215mm; padding: 0 12mm; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 11px;">
      <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 8px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; text-transform: uppercase;">${nombreEmpresa()}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; font-weight: bold;">${informe.titulo}</p>
        <p style="margin: 2px 0 0; font-size: 11px; text-transform: capitalize;">${escaparHtml(informe.periodo)}</p>
      </div>

      <p style="margin: 0 0 8px; font-size: 10px;"><strong>Vendedor:</strong> ${escaparHtml(informe.vendedorLabel || "Todos")}</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #000000;">
            <th style="text-align: left; padding: 5px;">Concepto</th>
            <th style="text-align: right; padding: 5px;">Pedidos</th>
            <th style="text-align: right; padding: 5px;">Valor</th>
          </tr>
        </thead>
        <tbody>${filasResumenHtml}</tbody>
      </table>
      <p style="margin: 6px 0 0; font-size: 9px; color: #475569;">
        Preventa, anulados, devueltos y pendientes se cuentan por fecha del pedido; las ventas, por fecha de entrega.
        Los pendientes reflejan el estado al momento de generar el informe.
      </p>

      ${detalleHtml}

      <p style="margin-top: 16px; font-size: 9px; color: #475569;">Generado el ${new Date().toLocaleString("es-CO")}</p>
    </div>
  `;
};

/** @param {InformeVentasPdf} informe */
export const exportarInformeVentasCarta = async (informe) => {
  const pdfUrl = await generarPdfBlobUrl(construirInformeVentasCartaHtml(informe), `${informe.nombreArchivo}.pdf`, {
    margin: [8, 0, 8, 0],
    jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "h3"] },
  });
  window.open(pdfUrl, "_blank");
};

// ----------------------------------------------------------------------------
// Tiquete 80mm
// ----------------------------------------------------------------------------

/** @param {InformeVentasPdf} informe */
export const construirInformeVentasTiqueteHtml = (informe) => {
  const linea = (f) => `
    <div style="margin-bottom: 6px; ${f.destacado ? "font-weight: bold;" : ""}">
      <div>${f.label}</div>
      <div style="display: flex; justify-content: space-between;">
        <span>${f.cantidad} ped.</span><span>${formatMoneda(f.monto)}</span>
      </div>
    </div>`;

  return `
    <div style="background-color: #ffffff; color: #000000; width: 72mm; padding: 12px; font-family: monospace; font-size: 11px;">
      <div style="text-align: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px dashed #000000;">
        <h3 style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin: 0;">${nombreEmpresa()}</h3>
        <p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 2px 0;">${informe.titulo}</p>
        <p style="font-size: 10px; margin: 2px 0; text-transform: capitalize;">${escaparHtml(informe.periodo)}</p>
        <p style="font-size: 10px; margin: 0;">Vendedor: ${escaparHtml(informe.vendedorLabel || "Todos")}</p>
      </div>

      ${filasResumen(informe).map(linea).join("")}

      <div style="border-top: 1px dashed #000000; padding-top: 6px; font-size: 9px; text-align: center;">
        Generado ${new Date().toLocaleString("es-CO")}
      </div>
    </div>
  `;
};

/** @param {InformeVentasPdf} informe */
export const exportarInformeVentasTiquete = async (informe) => {
  const pdfUrl = await generarPdfBlobUrl(
    construirInformeVentasTiqueteHtml(informe),
    `${informe.nombreArchivo}-tiquete.pdf`,
    {},
    { alturaAutomatica: true },
  );
  window.open(pdfUrl, "_blank");
};
