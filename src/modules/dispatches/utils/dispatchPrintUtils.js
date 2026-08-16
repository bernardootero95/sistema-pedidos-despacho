// src/modules/dispatches/utils/dispatchPrintUtils.js
import {
  construirComprobantePedidoHtml,
  generarPdfBlobUrl,
  formatCurrencyPdf,
  formatDatePdf,
} from "../../orders/utils/printUtils";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";

/**
 * Agrega las líneas de todos los pedidos del despacho en un mapa
 * producto_id -> { nombre, cantidad }. despachos_pedidos no tiene líneas
 * propias (solo vincula despacho-pedido); la mercancía real vive en
 * pedidos_detalle, una fila por pedido, así que hay que sumarla acá.
 */
const agregarMercanciaPorProducto = (pedidosCompletos) => {
  const resumen = new Map();

  pedidosCompletos.forEach((pedido) => {
    pedido.detalles?.forEach((item) => {
      const clave = item.producto_id;
      const actual = resumen.get(clave) || {
        nombre: item.producto?.nombre || "Producto",
        cantidad: 0,
      };
      actual.cantidad += Number(item.cantidad) || 0;
      resumen.set(clave, actual);
    });
  });

  return Array.from(resumen.values());
};

/**
 * Arma el HTML del tiquete de despacho: resumen agregado de mercancía por
 * producto (para cargar el vehículo) + desglose por pedido (para la ruta
 * de entrega), en un solo documento térmico 80mm.
 */
export const construirTiqueteDespachoHtml = (despacho, pedidosCompletos) => {
  const companyName =
    import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";

  const filasResumen = agregarMercanciaPorProducto(pedidosCompletos);
  const totalDespacho = pedidosCompletos.reduce(
    (acc, pedido) => acc + (Number(pedido.total) || 0),
    0,
  );

  return `
    <div style="background-color: #ffffff; color: #000000; width: 72mm; padding: 12px; font-family: monospace; font-size: 11px; display: flex; flex-direction: column; gap: 10px;">
      <div style="text-align: center; padding-bottom: 8px; border-bottom: 1px dashed #000000;">
        <h3 style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin: 0;">${companyName}</h3>
        <p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 2px 0;">TIQUETE DE DESPACHO</p>
        <p style="font-weight: bold; font-size: 13px; margin: 4px 0;">${despacho.codigo_despacho}</p>
        <p style="font-size: 10px; color: #333333; margin: 0;">Fecha: ${formatDatePdf(despacho.fecha_despacho)}</p>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000; font-size: 10px; display: flex; flex-direction: column; gap: 2px;">
        <p style="margin: 0;"><strong>Vehículo:</strong> ${despacho.vehiculo?.placa || "N/D"} ${despacho.vehiculo?.marca || ""}</p>
        <p style="margin: 0;"><strong>Repartidor:</strong> ${despacho.repartidor?.nombre_completo || "No asignado"}</p>
        <p style="margin: 0;"><strong>Pedidos incluidos:</strong> ${pedidosCompletos.length}</p>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000;">
        <p style="font-weight: bold; font-size: 10px; margin: 0 0 4px 0;">RESUMEN DE CARGUE (por producto)</p>
        <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
          <span style="grid-column: span 2 / span 2; text-align: center;">CANT</span>
          <span style="grid-column: span 10 / span 10;">PRODUCTO</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${filasResumen
            .map(
              (fila) => `
            <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-size: 10px;">
              <span style="grid-column: span 2 / span 2; text-align: center; font-weight: bold;">${fila.cantidad}</span>
              <span style="grid-column: span 10 / span 10;">${fila.nombre}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div style="padding-bottom: 8px; border-bottom: 1px dashed #000000;">
        <p style="font-weight: bold; font-size: 10px; margin: 0 0 4px 0;">DESGLOSE POR PEDIDO (ruta de entrega)</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${pedidosCompletos
            .map(
              (pedido) => `
            <div style="border-bottom: 1px solid #eeeeee; padding-bottom: 6px;">
              <p style="margin: 0; font-weight: bold; font-size: 10px;">Pedido N° ${pedido.numero_pedido} — ${getNombreCliente(pedido.clientes)}</p>
              <p style="margin: 0; font-size: 9px; color: #555555;">${pedido.clientes?.direccion || "Dirección no registrada"}</p>
              <div style="margin-top: 3px; display: flex; flex-direction: column; gap: 1px;">
                ${(pedido.detalles || [])
                  .map(
                    (item) => `
                  <div style="display: flex; justify-content: space-between; font-size: 9px;">
                    <span>${item.cantidad} x ${item.producto?.nombre}</span>
                    <span>${formatCurrencyPdf(item.subtotal_linea)}</span>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
        <span>TOTAL DESPACHO:</span><span>${formatCurrencyPdf(totalDespacho)}</span>
      </div>

      <div style="text-align: center; font-size: 9px; color: #333333;">
        <p style="font-size: 8px; margin: 0;">Sistema de pedidos y despacho desarrollado por TecnoIngenieria B.O.</p>
      </div>
    </div>
  `;
};

const descargarArchivo = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Imprime el tiquete de despacho y, en lote, el comprobante de cada
 * pedido incluido — como documentos SEPARADOS (no un PDF combinado): el
 * tiquete se abre en una pestaña nueva (igual que imprimirPedidoPdf), y
 * cada comprobante se descarga como archivo en vez de abrir una pestaña
 * por pedido, porque a partir de la segunda el navegador la bloquearía
 * como popup no solicitado.
 */
export const imprimirTiqueteYFacturasDespacho = async (
  despacho,
  pedidosCompletos,
) => {
  if (!despacho || !pedidosCompletos?.length) return;

  const tiqueteHtml = construirTiqueteDespachoHtml(despacho, pedidosCompletos);
  const tiqueteUrl = await generarPdfBlobUrl(
    tiqueteHtml,
    `tiquete-despacho-${despacho.codigo_despacho}.pdf`,
  );
  window.open(tiqueteUrl, "_blank");

  // Secuencial a propósito: cada conversión manipula el mismo DOM temporal
  // (ver generarPdfBlobUrl) y ejecutarlas en paralelo no aporta velocidad
  // real, html2canvas ya satura el hilo principal.
  for (const pedido of pedidosCompletos) {
    const comprobanteHtml = construirComprobantePedidoHtml(pedido);
    const filename = `comprobante-pedido-${pedido.numero_pedido}.pdf`;
    const comprobanteUrl = await generarPdfBlobUrl(comprobanteHtml, filename);
    descargarArchivo(comprobanteUrl, filename);
  }
};
