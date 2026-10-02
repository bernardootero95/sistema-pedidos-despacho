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

// Ancho útil de una hoja carta (215.9mm) con 10mm de margen por lado.
export const ANCHO_CARTA_MM = 196;

const BORDE = "1px solid #cbd5e1";
const ETIQUETA = "font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;";
const CELDA = `padding: 5px 6px; border-bottom: ${BORDE}; font-size: 9.5px; vertical-align: top;`;

const dato = (etiqueta, valor) =>
  valor
    ? `<div style="margin-bottom: 4px;"><div style="${ETIQUETA}">${etiqueta}</div><div style="font-size: 10px; font-weight: 600;">${valor}</div></div>`
    : "";

const encabezado = (pedido, emisor, logoDataUrl, electronica) => `
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      ${
        logoDataUrl
          ? `<td style="width: 48mm; vertical-align: middle; padding-right: 8px;">
               <img src="${logoDataUrl}" style="max-width: 46mm; max-height: 26mm; object-fit: contain; display: block;" />
             </td>`
          : ""
      }
      <td style="vertical-align: middle;">
        <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; line-height: 1.15;">${esc(emisor.titulo)}</div>
        ${emisor.razonSocial ? `<div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; margin-top: 2px;">${esc(emisor.razonSocial)}</div>` : ""}
        ${emisor.lineas.map((l) => `<div style="font-size: 9.5px; color: #334155; margin-top: 2px;">${esc(l)}</div>`).join("")}
      </td>
      <td style="width: 62mm; vertical-align: top;">
        <div style="border: 1.5px solid #0f172a; border-radius: 6px; padding: 8px 10px; text-align: center;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
            ${electronica ? "Factura electrónica de venta" : "Pedido"}
          </div>
          <div style="font-size: 17px; font-weight: 800; margin: 3px 0;">
            N° ${esc(electronica ? pedido.ingefact_numero_factura : pedido.numero_pedido)}
          </div>
          <div style="font-size: 9px; color: #334155;">
            ${electronica ? `Emisión: ${formatDatePdf(pedido.ingefact_enviado_en)}` : `Fecha: ${formatDatePdf(pedido.fecha_pedido)}`}
          </div>
          ${electronica ? `<div style="font-size: 9px; color: #334155;">Pedido N° ${esc(pedido.numero_pedido)}</div>` : ""}
        </div>
      </td>
    </tr>
  </table>
`;

const bloqueCliente = (pedido) => {
  const cliente = pedido.clientes;
  const identificacion = cliente?.numero_identificacion
    ? `${esc(cliente.tipo_identificacion || "")} ${esc(cliente.numero_identificacion)}${cliente.digito_verificacion ? `-${esc(cliente.digito_verificacion)}` : ""}`.trim()
    : null;

  return `
    <table style="width: 100%; border-collapse: collapse; border: ${BORDE}; border-radius: 6px; margin-bottom: 10px;">
      <tr>
        <td style="width: 60%; padding: 8px 10px; vertical-align: top; border-right: ${BORDE};">
          ${dato("Cliente", esc(getNombreCliente(cliente)))}
          ${dato("Identificación", identificacion)}
          ${dato("Dirección", esc(cliente?.direccion || "No registrada"))}
          ${dato("Teléfono / Correo", [cliente?.telefono, cliente?.correo].filter(Boolean).map(esc).join(" · "))}
        </td>
        <td style="padding: 8px 10px; vertical-align: top;">
          ${dato("Fecha del pedido", formatDatePdf(pedido.fecha_pedido))}
          ${pedido.fecha_entrega ? dato("Fecha de entrega", formatDatePdf(pedido.fecha_entrega)) : ""}
          ${dato("Vendedor", esc(pedido.vendedor?.nombre_completo))}
        </td>
      </tr>
    </table>
  `;
};

const tablaDetalle = (detalles = []) => `
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff;">
        <th style="padding: 6px; font-size: 8.5px; text-align: center; width: 7mm;">#</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: left; width: 22mm;">CÓDIGO</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: left;">DESCRIPCIÓN</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: right; width: 15mm;">CANT.</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: right; width: 26mm;">V. UNITARIO</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: right; width: 14mm;">IMP.</th>
        <th style="padding: 6px; font-size: 8.5px; text-align: right; width: 28mm;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${detalles
        .map((item, i) => {
          const iva = Math.round(Number(item.iva_porcentaje) || 0);
          const inc = Math.round(Number(item.inc_porcentaje) || 0);
          const impuesto = [iva && `IVA ${iva}%`, inc && `INC ${inc}%`].filter(Boolean).join(" ") || "—";
          return `
          <tr style="background-color: ${i % 2 ? "#f8fafc" : "#ffffff"};">
            <td style="${CELDA} text-align: center; color: #64748b;">${i + 1}</td>
            <td style="${CELDA}">${esc(item.producto?.codigo)}</td>
            <td style="${CELDA} font-weight: 600;">${esc(item.producto?.nombre)}</td>
            <td style="${CELDA} text-align: right;">${item.cantidad}</td>
            <td style="${CELDA} text-align: right;">${formatCurrencyPdf(item.precio_unitario)}</td>
            <td style="${CELDA} text-align: right; font-size: 8.5px;">${impuesto}</td>
            <td style="${CELDA} text-align: right; font-weight: 700;">${formatCurrencyPdf(item.subtotal_linea)}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
`;

const filaTotal = (etiqueta, valor, destacado = false) => `
  <tr>
    <td style="padding: ${destacado ? "7px 8px" : "4px 8px"}; font-size: ${destacado ? "12px" : "10px"}; font-weight: ${destacado ? 800 : 600}; ${destacado ? "background-color: #0f172a; color: #ffffff;" : ""}">${etiqueta}</td>
    <td style="padding: ${destacado ? "7px 8px" : "4px 8px"}; font-size: ${destacado ? "12px" : "10px"}; font-weight: ${destacado ? 800 : 600}; text-align: right; ${destacado ? "background-color: #0f172a; color: #ffffff;" : ""}">${formatCurrencyPdf(valor)}</td>
  </tr>
`;

const bloqueTotales = (pedido, electronica) => {
  const { subtotal, impuestos } = calcularTotales(pedido.detalles);
  const resumenPagos = resumirPagosParaTicket(pedido);

  const izquierda = [
    electronica ? dato("Forma de pago", `Contado · ${esc(mediosDePago(pedido))}`) : "",
    resumenPagos
      ? dato(
          "Pagos",
          resumenPagos.lineas.map((l) => `${esc(l.nombre)}: ${formatCurrencyPdf(l.monto)}`).join("<br/>") +
            (resumenPagos.saldo > 0 ? `<br/><strong>Saldo por cobrar: ${formatCurrencyPdf(resumenPagos.saldo)}</strong>` : ""),
        )
      : "",
    pedido.notas ? dato("Notas", `<span style="font-style: italic;">${esc(pedido.notas)}</span>`) : "",
  ].join("");

  return `
    <table class="evitar-corte" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">${izquierda}</td>
        <td style="width: 74mm; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse; border: ${BORDE};">
            ${filaTotal("Subtotal", subtotal)}
            ${impuestos.map((i) => filaTotal(i.etiqueta, i.valor)).join("")}
            ${filaTotal("TOTAL", pedido.total, true)}
          </table>
        </td>
      </tr>
    </table>
  `;
};

const bloqueElectronico = (pedido, emisor, qrDataUrl) => `
  <table class="evitar-corte" style="width: 100%; border-collapse: collapse; border: ${BORDE}; margin-bottom: 10px;">
    <tr>
      ${qrDataUrl ? `<td style="width: 34mm; padding: 8px; vertical-align: middle;"><img src="${qrDataUrl}" style="width: 30mm; height: 30mm; display: block;" /></td>` : ""}
      <td style="padding: 8px 10px; vertical-align: middle;">
        <div style="${ETIQUETA}">CUFE</div>
        <div style="font-size: 8.5px; font-family: monospace; word-break: break-all; margin-bottom: 6px;">${esc(pedido.ingefact_cufe || "No disponible")}</div>
        ${emisor.resolucion ? `<div style="${ETIQUETA}">Resolución de facturación</div><div style="font-size: 9px; margin-bottom: 6px;">${esc(emisor.resolucion)}</div>` : ""}
        <div style="font-size: 8.5px; color: #475569;">Representación gráfica de la factura electrónica de venta.</div>
      </td>
    </tr>
  </table>
`;

/**
 * Pedido o factura electrónica en hoja carta, según el pedido tenga una
 * factura vigente. Mismo `contexto` que construirTirillaHtml.
 */
export const construirCartaHtml = (pedido, contexto = {}) => {
  const electronica = esFacturaElectronica(pedido);
  const emisor = datosEmisor(contexto.empresa);

  return `
    <div style="background-color: #ffffff; color: #0f172a; width: ${ANCHO_CARTA_MM}mm; font-family: Arial, Helvetica, sans-serif;">
      ${encabezado(pedido, emisor, contexto.logoDataUrl, electronica)}
      ${bloqueCliente(pedido)}
      ${tablaDetalle(pedido.detalles)}
      ${bloqueTotales(pedido, electronica)}
      ${electronica ? bloqueElectronico(pedido, emisor, contexto.qrDataUrl) : ""}
      <div class="evitar-corte" style="text-align: center; font-size: 9px; color: #475569; border-top: ${BORDE}; padding-top: 6px;">
        <div style="font-weight: 700; color: #0f172a;">¡Gracias por su compra!</div>
        <div>Sistema de pedidos y despacho desarrollado por TecnoIngenieria B.O.</div>
      </div>
    </div>
  `;
};
