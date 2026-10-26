// src/modules/reports/utils/priceListPdfUtils.js
import { formatCurrencyPdf, generarPdfPaginasBlobUrl } from "../../orders/utils/printUtils";
import { formatEscalas } from "./priceList";

// Con más de dos tipos de precio la hoja va horizontal para que quepan las
// columnas.
const ANCHO_MM = { portrait: 210, landscape: 297 };
const ALTO_MM = { portrait: 297, landscape: 210 };
const MARGEN_MM = 10;
// Espacio inferior reservado para el pie (fecha y número de página).
const RESERVA_PIE_MM = 14;
const PX_POR_MM = 96 / 25.4;
// 297 mm son 1122,5 px; el navegador redondea la hoja a 1123 y html2pdf
// agrega una página en blanco por el medio píxel sobrante.
const AJUSTE_ALTO_MM = 0.5;

const escaparHtml = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const celda = (contenido, alineacion = "left") =>
  `<td style="padding: 4px 5px; text-align: ${alineacion}; vertical-align: top;">${contenido}</td>`;

const encabezado = (texto, alineacion = "left") =>
  `<th style="padding: 5px; text-align: ${alineacion};">${escaparHtml(texto)}</th>`;

const filaHtml = (f, tipos, conEscalas) => `
  <tr style="border-bottom: 1px solid #e2e8f0;">
    ${celda(escaparHtml(f.codigo))}
    ${celda(escaparHtml(f.nombre))}
    ${celda(formatCurrencyPdf(f.precioVenta), "right")}
    ${tipos.map((t) => celda(f.preciosTipo[t.id] == null ? "—" : formatCurrencyPdf(f.preciosTipo[t.id]), "right")).join("")}
    ${conEscalas ? celda(escaparHtml(formatEscalas(f.escalas))) : ""}
  </tr>`;

/**
 * Una hoja A4. `numero`/`total` vacíos = hoja de medición (sin alto fijo,
 * para que la tabla crezca y se pueda medir cada fila).
 */
const construirHoja = ({ filasHtml, tipos, conEscalas, orientacion, titulo, subtitulo, numero, total }) => {
  const medicion = numero == null;
  return `
    <div style="background-color: #ffffff; color: #000000; width: ${ANCHO_MM[orientacion]}mm; ${medicion ? "" : `height: ${ALTO_MM[orientacion] - AJUSTE_ALTO_MM}mm; overflow: hidden;`} box-sizing: border-box; padding: ${MARGEN_MM}mm; font-family: Arial, sans-serif; font-size: 10px; position: relative;">
      <div data-bloque="titulo" style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 15px; text-transform: uppercase;">${escaparHtml(titulo)}</h2>
        <p style="margin: 3px 0 0; font-size: 12px; font-weight: bold;">Lista de Precios</p>
        <p style="margin: 2px 0 0; font-size: 9px; color: #475569;">${escaparHtml(subtitulo)}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #000000;">
            ${encabezado("Código")}
            ${encabezado("Producto")}
            ${encabezado("Precio", "right")}
            ${tipos.map((t) => encabezado(t.nombre, "right")).join("")}
            ${conEscalas ? encabezado("Por mayor") : ""}
          </tr>
        </thead>
        <tbody>${filasHtml.join("")}</tbody>
      </table>
      ${
        medicion
          ? ""
          : `<div style="position: absolute; bottom: 6mm; left: ${MARGEN_MM}mm; right: ${MARGEN_MM}mm; font-size: 8px; color: #475569; display: flex; justify-content: space-between;">
              <span>Generado el ${new Date().toLocaleString("es-CO")}</span>
              <span>Página ${numero} de ${total}</span>
            </div>`
      }
    </div>
  `;
};

/**
 * Reparte las filas en hojas según su alto real: los nombres largos y las
 * escalas al por mayor ocupan varios renglones, así que una cantidad fija por
 * hoja deja filas cortadas. Se pinta una hoja de medición fuera de pantalla,
 * con el mismo ancho y estilos, y se llena cada hoja hasta el alto útil.
 *
 * @returns {number[][]} índices de filas por hoja
 */
const repartirEnHojas = (hojaMedicionHtml, orientacion) => {
  const contenedor = document.createElement("div");
  contenedor.style.cssText = "position: fixed; left: -10000px; top: 0; visibility: hidden;";
  contenedor.innerHTML = hojaMedicionHtml;
  document.body.appendChild(contenedor);

  try {
    const hoja = contenedor.firstElementChild;
    const titulo = hoja.querySelector('[data-bloque="titulo"]');
    const thead = hoja.querySelector("thead");
    const altos = [...hoja.querySelectorAll("tbody tr")].map((tr) => tr.getBoundingClientRect().height);

    const estiloTitulo = getComputedStyle(titulo);
    const altoTitulo = titulo.getBoundingClientRect().height + parseFloat(estiloTitulo.marginBottom);
    const util =
      (ALTO_MM[orientacion] - MARGEN_MM - RESERVA_PIE_MM) * PX_POR_MM - altoTitulo - thead.getBoundingClientRect().height;

    const hojas = [];
    let actual = [];
    let ocupado = 0;
    altos.forEach((alto, i) => {
      if (actual.length > 0 && ocupado + alto > util) {
        hojas.push(actual);
        actual = [];
        ocupado = 0;
      }
      actual.push(i);
      ocupado += alto;
    });
    if (actual.length > 0) hojas.push(actual);
    return hojas;
  } finally {
    document.body.removeChild(contenedor);
  }
};

/**
 * Lista de precios en PDF A4, una hoja HTML por página (ver
 * generarPdfPaginasBlobUrl) para que no se corte con catálogos grandes.
 *
 * @param {{ filas: Array<Object>, tipos: Array<{id: string, nombre: string}>, filtroLabel: string, nombreArchivo: string }} lista
 */
export const exportarListaPreciosPdf = async ({ filas, tipos, filtroLabel, nombreArchivo }) => {
  const orientacion = tipos.length > 2 ? "landscape" : "portrait";
  const conEscalas = filas.some((f) => f.escalas.length > 0);
  const titulo = import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";
  const subtitulo = `${filtroLabel} · ${filas.length} ${filas.length === 1 ? "producto" : "productos"}`;
  const filasHtml = filas.map((f) => filaHtml(f, tipos, conEscalas));
  const base = { tipos, conEscalas, orientacion, titulo, subtitulo };

  const reparto = repartirEnHojas(construirHoja({ ...base, filasHtml }), orientacion);
  const hojas = reparto.map((indices, i) =>
    construirHoja({ ...base, filasHtml: indices.map((j) => filasHtml[j]), numero: i + 1, total: reparto.length }),
  );

  const pdfUrl = await generarPdfPaginasBlobUrl(hojas, `${nombreArchivo}.pdf`, {
    jsPDF: { unit: "mm", format: "a4", orientation: orientacion },
  });
  window.open(pdfUrl, "_blank");
};
