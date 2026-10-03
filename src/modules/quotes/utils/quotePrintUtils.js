import { printService } from "../../orders/services/printService";
import {
  generarPdfBlobUrl,
  OPCIONES_PDF_CARTA,
} from "../../orders/utils/printUtils";
import { construirCotizacionHtml } from "./print/plantillaCotizacion";

/**
 * Genera el PDF (carta) de una cotización y lo abre en una pestaña nueva.
 * Reutiliza el contexto de impresión de Datos Empresa (emisor y logo).
 */
export const imprimirCotizacionPdf = async (cotizacion, detalles) => {
  if (!cotizacion) return;

  try {
    const contexto = await printService.obtenerContexto();
    const url = await generarPdfBlobUrl(
      construirCotizacionHtml(cotizacion, detalles, contexto),
      `cotizacion-${cotizacion.numero_cotizacion}.pdf`,
      OPCIONES_PDF_CARTA,
    );
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error al generar el PDF de la cotización:", error);
    throw new Error("No se pudo generar el PDF de la cotización.", {
      cause: error,
    });
  }
};
