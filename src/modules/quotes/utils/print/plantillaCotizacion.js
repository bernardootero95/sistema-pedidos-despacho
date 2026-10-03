import { getNombreCliente } from "../../../clients/utils/clienteDisplay";
import { formatCurrencyPdf } from "../../../orders/utils/print/formato";
import {
  esc,
  datosEmisor,
  calcularTotales,
} from "../../../orders/utils/print/comprobanteDatos";
import { ANCHO_CARTA_MM } from "../../../orders/utils/print/plantillaCarta";

const BORDE = "1px solid #cbd5e1";
const ETIQUETA =
  "font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;";
const CELDA = `padding: 5px 6px; border-bottom: ${BORDE}; font-size: 9.5px; vertical-align: top;`;

// timeZone UTC: tanto fecha_vencimiento (DATE) como el instante de creación
// se muestran por día calendario, sin que el huso del navegador lo corra.
const formatoFecha = (valor, timeZone = "UTC") =>
  new Date(valor).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });

const dato = (etiqueta, valor) =>
  valor
    ? `<div style="margin-bottom: 4px;"><div style="${ETIQUETA}">${etiqueta}</div><div style="font-size: 10px; font-weight: 600;">${valor}</div></div>`
    : "";

const encabezado = (cotizacion, emisor, logoDataUrl) => `
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
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Cotización</div>
          <div style="font-size: 17px; font-weight: 800; margin: 3px 0;">N° ${esc(cotizacion.numero_cotizacion)}</div>
          <div style="font-size: 9px; color: #334155;">Fecha: ${formatoFecha(cotizacion.fecha_cotizacion, "America/Bogota")}</div>
          <div style="font-size: 9px; font-weight: 700; color: #0f172a;">Válida hasta: ${formatoFecha(cotizacion.fecha_vencimiento)}</div>
        </div>
      </td>
    </tr>
  </table>
`;

const bloqueCliente = (cotizacion) => {
  const cliente = cotizacion.cliente;
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
          ${dato("Elaborada por", esc(cotizacion.usuario?.nombre_completo))}
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
          const impuesto =
            [iva && `IVA ${iva}%`, inc && `INC ${inc}%`].filter(Boolean).join(" ") || "—";
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

const filaTotal = (etiqueta, valor, destacado = false) => {
  const estilo = destacado
    ? "padding: 7px 8px; font-size: 12px; font-weight: 800; background-color: #0f172a; color: #ffffff;"
    : "padding: 4px 8px; font-size: 10px; font-weight: 600;";
  return `<tr><td style="${estilo}">${etiqueta}</td><td style="${estilo} text-align: right;">${formatCurrencyPdf(valor)}</td></tr>`;
};

const bloqueTotales = (cotizacion, detalles) => {
  const { subtotal, impuestos } = calcularTotales(detalles);
  return `
    <table class="evitar-corte" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">
          ${cotizacion.notas ? dato("Notas", `<span style="font-style: italic;">${esc(cotizacion.notas)}</span>`) : ""}
        </td>
        <td style="width: 74mm; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse; border: ${BORDE};">
            ${filaTotal("Subtotal", subtotal)}
            ${impuestos.map((i) => filaTotal(i.etiqueta, i.valor)).join("")}
            ${filaTotal("TOTAL", cotizacion.total, true)}
          </table>
        </td>
      </tr>
    </table>
  `;
};

/**
 * Cotización en hoja carta. `contexto` es el de printService.obtenerContexto
 * ({ empresa, logoDataUrl }); las cotizaciones siempre se imprimen en carta,
 * sin importar el formato elegido para pedidos y facturas.
 */
export const construirCotizacionHtml = (cotizacion, detalles, contexto = {}) => {
  const emisor = datosEmisor(contexto.empresa);

  return `
    <div style="background-color: #ffffff; color: #0f172a; width: ${ANCHO_CARTA_MM}mm; font-family: Arial, Helvetica, sans-serif;">
      ${encabezado(cotizacion, emisor, contexto.logoDataUrl)}
      ${bloqueCliente(cotizacion)}
      ${tablaDetalle(detalles)}
      ${bloqueTotales(cotizacion, detalles)}
      <div class="evitar-corte" style="text-align: center; font-size: 9px; color: #475569; border-top: ${BORDE}; padding-top: 6px;">
        <div>Esta cotización es válida hasta el ${formatoFecha(cotizacion.fecha_vencimiento)}. Los precios incluyen impuestos y pueden variar después de esa fecha.</div>
        <div>Sistema de pedidos y despacho desarrollado por TecnoIngenieria B.O.</div>
      </div>
    </div>
  `;
};
