import { settingsService } from "../../settings/services/settingsService";
import { companyService } from "../../settings/services/companyService";
import { urlQrDian } from "../utils/print/comprobanteDatos";

/**
 * html2canvas solo dibuja imágenes de otro origen si el servidor manda
 * CORS y aun así puede "manchar" el canvas: se incrusta el logo como data
 * URL antes de armar el HTML. Si falla, el comprobante sale sin logo en vez
 * de no salir.
 */
const imagenComoDataUrl = async (url) => {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    return await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = reject;
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const printService = {
  /**
   * Lo que necesitan las plantillas además del pedido: formato elegido en
   * Opciones, datos del emisor y logo (solo si está cargado y la opción de
   * imprimirlo está encendida). Se consulta en cada impresión (o una vez
   * por lote) para no imprimir con datos viejos.
   */
  async obtenerContexto() {
    const [config, empresa] = await Promise.all([
      settingsService.getConfiguracion(),
      companyService.getDatosEmpresa(),
    ]);

    const logoDataUrl =
      config.imprimirLogoActivo && empresa.logoUrl
        ? await imagenComoDataUrl(empresa.logoUrl)
        : null;

    return { formatoCarta: config.impresionCartaActivo, empresa, logoDataUrl };
  },

  /** QR de consulta DIAN del pedido, o null si no tiene CUFE. */
  async generarQrFactura(pedido) {
    const url = urlQrDian(pedido?.ingefact_cufe);
    if (!url) return null;
    // Import dinámico: solo se descarga al imprimir una factura electrónica.
    const { toDataURL } = await import("qrcode");
    return toDataURL(url, { margin: 0, width: 300, errorCorrectionLevel: "M" });
  },
};
