// src/modules/orders/utils/printUtils.js
import { construirTirillaHtml } from "./print/plantillaTirilla";
import { construirCartaHtml } from "./print/plantillaCarta";
import { esFacturaElectronica } from "./print/comprobanteDatos";
import { printService } from "../services/printService";

export { formatCurrencyPdf, formatDatePdf } from "./print/formato";

/**
 * Convierte un fragmento HTML (string, ya armado por construirXHtml) en un
 * blob URL de PDF vía html2pdf.js. No abre ni descarga nada por sí solo —
 * cada llamador decide qué hacer con la URL (abrir en pestaña nueva, forzar
 * descarga, etc.), ya que eso varía según el caso de uso (un comprobante
 * suelto vs. un lote de varios vs. un informe tabular).
 *
 * `optsOverride` reemplaza el formato térmico 80mm por defecto — lo usa el
 * informe de productos (reports/utils/reportPdfUtils.js) para generar un
 * PDF A4, en vez de duplicar todo el mecanismo de html2pdf solo por eso.
 *
 * `alturaAutomatica` ajusta el alto de la página térmica al contenido
 * renderizado (un solo tiquete continuo, sin cortes ni papel en blanco) y
 * marca el PDF para imprimirse a tamaño real; lo usan las tirillas de
 * pedido/factura y el tiquete del informe de ventas, cuyo largo varía.
 */
export const generarPdfBlobUrl = async (html, filename, optsOverride = {}, { alturaAutomatica = false } = {}) => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1000";
  container.innerHTML = html;

  document.body.appendChild(container);

  const opt = {
    margin: 0,
    filename,
    image: { type: "jpeg", quality: 1 },
    html2canvas: { scale: 3, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" },
    ...optsOverride,
  };

  if (alturaAutomatica) {
    const MM_POR_PX = 25.4 / 96;
    const [ancho] = opt.jsPDF.format;
    const alto = Math.ceil(container.firstElementChild.offsetHeight * MM_POR_PX) + 2;
    opt.jsPDF = { ...opt.jsPDF, format: [ancho, Math.max(alto, ancho)] };
  }

  try {
    // Import dinámico: html2pdf.js (~900KB) solo se descarga cuando se
    // imprime algo, no en el chunk inicial de cada página que importa
    // este util.
    const { default: html2pdf } = await import(
      "html2pdf.js/dist/html2pdf.min.js"
    );

    // Damos un pequeño respiro de 250ms para garantizar que el DOM pinte el contenido antes de convertir a PDF
    await new Promise((resolve) => setTimeout(resolve, 250));

    const worker = html2pdf().set(opt).from(container.firstElementChild);
    if (!alturaAutomatica) return await worker.output("bloburl");

    // El tiquete es una sola página tan larga como el contenido. Sin esto,
    // el diálogo de impresión la "ajusta al área imprimible" del papel del
    // driver y reduce todo el tiquete cuando el pedido trae muchos
    // productos; PrintScaling /None hace que abra a tamaño real.
    const pdf = await worker.toPdf().get("pdf");
    pdf.viewerPreferences({ PrintScaling: "None" });
    return pdf.output("bloburl");
  } finally {
    document.body.removeChild(container);
  }
};

// Hoja carta: márgenes en mm [arriba, izquierda, abajo, derecha]; el ancho
// útil coincide con ANCHO_CARTA_MM de la plantilla.
const OPCIONES_PDF_CARTA = {
  margin: [10, 10, 12, 10],
  jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
  pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".evitar-corte"] },
};

/**
 * Genera el PDF de un pedido con el diseño que corresponde: tamaño carta o
 * tirilla según Datos Empresa, y como factura electrónica si el pedido tiene una
 * vigente. `contexto` (printService.obtenerContexto) se pasa desde afuera
 * para que un lote lo consulte una sola vez.
 */
export const generarComprobantePdf = async (pedidoCompleto, contexto) => {
  const electronica = esFacturaElectronica(pedidoCompleto);
  const contextoPedido = electronica
    ? {
        ...contexto,
        qrDataUrl: await printService.generarQrFactura(pedidoCompleto),
      }
    : contexto;

  const nombreArchivo = electronica
    ? `factura-${pedidoCompleto.ingefact_numero_factura}.pdf`
    : `pedido-${pedidoCompleto.numero_pedido}.pdf`;

  const url = contexto.formatoCarta
    ? await generarPdfBlobUrl(
        construirCartaHtml(pedidoCompleto, contextoPedido),
        nombreArchivo,
        OPCIONES_PDF_CARTA,
      )
    : await generarPdfBlobUrl(
        construirTirillaHtml(pedidoCompleto, contextoPedido),
        nombreArchivo,
        {},
        { alturaAutomatica: true },
      );

  return { url, nombreArchivo };
};

export const imprimirPedidoPdf = async (pedidoCompleto) => {
  if (!pedidoCompleto) return;

  try {
    const contexto = await printService.obtenerContexto();
    const { url } = await generarComprobantePdf(pedidoCompleto, contexto);
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error al generar el PDF del pedido:", error);
    throw new Error("No se pudo generar el comprobante PDF.", {
      cause: error,
    });
  }
};
