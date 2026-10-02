import { getNombreCliente } from "../../../clients/utils/clienteDisplay";
import { resumirPagosParaTicket } from "../../../payments/utils/ticketPagos";
import { formatCurrencyPdf, formatDatePdf } from "./formato";
import {
  esc,
  esFacturaElectronica,
  datosEmisor,
  calcularTotales,
  mediosDePago,
} from "./comprobanteDatos";

const SEPARADOR = "padding-bottom: 8px; border-bottom: 1px dashed #000000;";
const FILA = "display: flex; justify-content: space-between;";

const encabezado = (pedido, emisor, logoDataUrl, electronica) => `
  <div style="text-align: center; ${SEPARADOR}">
    ${logoDataUrl ? `<img src="${logoDataUrl}" style="max-width: 50mm; max-height: 20mm; object-fit: contain; margin: 0 auto 6px; display: block;" />` : ""}
    <h3 style="font-weight: bold; font-size: 14px; text-transform: uppercase; margin: 0;">${esc(emisor.titulo)}</h3>
    ${emisor.razonSocial ? `<p style="font-weight: bold; font-size: 10px; text-transform: uppercase; margin: 2px 0 0;">${esc(emisor.razonSocial)}</p>` : ""}
    ${emisor.lineas.map((l) => `<p style="font-size: 9px; font-weight: 600; margin: 1px 0 0;">${esc(l)}</p>`).join("")}
    ${
      electronica
        ? `<p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 6px 0 2px;">FACTURA ELECTRÓNICA DE VENTA</p>
           <p style="font-weight: bold; font-size: 13px; margin: 2px 0;">N° ${esc(pedido.ingefact_numero_factura)}</p>
           <p style="font-size: 10px; font-weight: 600; margin: 0;">Emisión: ${formatDatePdf(pedido.ingefact_enviado_en)}</p>
           <p style="font-size: 9px; font-weight: 600; margin: 0;">Pedido N° ${esc(pedido.numero_pedido)}</p>`
        : `<p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 6px 0 2px;">COMPROBANTE DE DESPACHO</p>
           <p style="font-weight: bold; font-size: 13px; margin: 4px 0;">Pedido N°: ${esc(pedido.numero_pedido)}</p>
           <p style="font-size: 10px; font-weight: 600; margin: 0;">Fecha: ${formatDatePdf(pedido.fecha_pedido)}</p>`
    }
  </div>
`;

const pieElectronico = (pedido, emisor, qrDataUrl) => `
  <div style="${SEPARADOR} font-size: 9px; font-weight: 600; text-align: center; display: flex; flex-direction: column; gap: 4px; align-items: center;">
    <p style="margin: 0;"><strong>Forma de pago:</strong> Contado · ${esc(mediosDePago(pedido))}</p>
    ${qrDataUrl ? `<img src="${qrDataUrl}" style="width: 30mm; height: 30mm;" />` : ""}
    <p style="margin: 0; word-break: break-all;"><strong>CUFE:</strong> ${esc(pedido.ingefact_cufe || "No disponible")}</p>
    ${emisor.resolucion ? `<p style="margin: 0;">${esc(emisor.resolucion)}</p>` : ""}
    <p style="margin: 0;">Representación gráfica de la factura electrónica</p>
  </div>
`;

/**
 * Comprobante térmico 80mm de un pedido: tirilla de pedido o tirilla POS de
 * factura electrónica según el pedido tenga una factura vigente.
 *
 * `contexto` = { empresa, logoDataUrl, qrDataUrl } (ver
 * services/printService.js). Sin contexto imprime como antes de existir los
 * datos de empresa: solo el nombre del .env.
 */
export const construirTirillaHtml = (pedido, contexto = {}) => {
  const electronica = esFacturaElectronica(pedido);
  const emisor = datosEmisor(contexto.empresa);
  const { subtotal, impuestos } = calcularTotales(pedido.detalles);
  const resumenPagos = resumirPagosParaTicket(pedido);
  const cliente = pedido.clientes;

  return `
    <div style="background-color: #ffffff; color: #000000; width: 72mm; padding: 12px; font-family: monospace; font-size: 11px; display: flex; flex-direction: column; gap: 10px;">
      ${encabezado(pedido, emisor, contexto.logoDataUrl, electronica)}

      <div style="${SEPARADOR} font-size: 10px; font-weight: 600; display: flex; flex-direction: column; gap: 2px;">
        <p style="margin: 0;"><strong>Cliente:</strong> ${esc(getNombreCliente(cliente))}</p>
        <p style="margin: 0;"><strong>Tipo ID:</strong> ${esc(cliente?.tipo_identificacion || "NIT / CC")}</p>
        <p style="margin: 0;"><strong>N° Identificación:</strong> ${esc(cliente?.numero_identificacion)}${cliente?.digito_verificacion ? `-${esc(cliente.digito_verificacion)}` : ""}</p>
        <p style="margin: 0;"><strong>Dirección:</strong> ${esc(cliente?.direccion || "No registrada")}</p>
        <p style="margin: 0;"><strong>Vendedor:</strong> ${esc(pedido.vendedor?.nombre_completo)}</p>
      </div>

      <div style="${SEPARADOR}">
        <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
          <span style="grid-column: span 2 / span 2; text-align: center;">CANT</span>
          <span style="grid-column: span 6 / span 6;">PRODUCTO</span>
          <span style="grid-column: span 4 / span 4; text-align: right;">TOTAL</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${(pedido.detalles || [])
            .map(
              (item) => `
            <div style="display: flex; flex-direction: column; border-bottom: 1px solid #eeeeee; padding-bottom: 4px;">
              <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); font-size: 10px; font-weight: 600;">
                <span style="grid-column: span 2 / span 2; text-align: center; font-weight: bold;">${item.cantidad}</span>
                <span style="grid-column: span 6 / span 6; font-weight: bold;">${esc(item.producto?.nombre)}</span>
                <span style="grid-column: span 4 / span 4; text-align: right;">${formatCurrencyPdf(item.subtotal_linea)}</span>
              </div>
              <div style="font-size: 9px; font-weight: 600; padding-left: 8px;">V. Unit: ${formatCurrencyPdf(item.precio_unitario)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div style="${SEPARADOR} display: flex; flex-direction: column; gap: 4px; font-size: 10px; font-weight: 600;">
        <div style="${FILA}"><span>SUBTOTAL:</span><span>${formatCurrencyPdf(subtotal)}</span></div>
        ${impuestos.map((i) => `<div style="${FILA}"><span>${i.etiqueta}:</span><span>${formatCurrencyPdf(i.valor)}</span></div>`).join("")}
        <div style="${FILA} font-weight: bold; font-size: 12px; border-top: 1px solid #000000; padding-top: 4px; margin-top: 2px;">
          <span>TOTAL:</span><span>${formatCurrencyPdf(pedido.total)}</span>
        </div>
      </div>

      ${
        resumenPagos
          ? `
        <div style="${SEPARADOR} display: flex; flex-direction: column; gap: 4px; font-size: 10px; font-weight: 600;">
          <strong>PAGOS:</strong>
          ${resumenPagos.lineas.map((linea) => `<div style="${FILA}"><span>${esc(linea.nombre)}:</span><span>${formatCurrencyPdf(linea.monto)}</span></div>`).join("")}
          ${
            resumenPagos.saldo > 0
              ? `<div style="${FILA} font-weight: bold; font-size: 11px; border-top: 1px solid #000000; padding-top: 4px;"><span>SALDO POR COBRAR:</span><span>${formatCurrencyPdf(resumenPagos.saldo)}</span></div>`
              : ""
          }
        </div>
      `
          : ""
      }

      ${
        pedido.notas
          ? `
        <div style="${SEPARADOR} font-size: 10px;">
          <strong style="display: block;">Notas:</strong>
          <p style="margin: 0; font-weight: 600; font-style: italic;">${esc(pedido.notas)}</p>
        </div>
      `
          : ""
      }

      ${electronica ? pieElectronico(pedido, emisor, contexto.qrDataUrl) : ""}

      <div style="text-align: center; font-size: 9px; font-weight: 600; display: flex; flex-direction: column; gap: 2px;">
        <p style="font-weight: bold; margin: 0;">¡Gracias por su compra!</p>
        <p style="font-size: 9px; font-weight: 600; margin: 0;">Sistema de pedidos y despacho desarrollado por TecnoIngenieria B.O.</p>
      </div>
    </div>
  `;
};
