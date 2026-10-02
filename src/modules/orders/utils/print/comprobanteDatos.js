/**
 * Reglas de contenido compartidas por los 4 diseños de comprobante (tirilla
 * y carta, pedido y factura electrónica). Solo datos: el HTML de cada
 * diseño vive en su plantilla.
 */

const NOMBRE_EMPRESA_POR_DEFECTO =
  import.meta.env.VITE_COMPANY_NAME || "SISTEMA DE PEDIDOS";

// URL de consulta pública de la DIAN por CUFE: es lo que codifica el QR de
// la representación gráfica.
const URL_CONSULTA_DIAN =
  "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=";

/** Escapa texto de usuario antes de interpolarlo en las plantillas HTML. */
export const esc = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Un pedido se imprime como factura electrónica solo si tiene una factura
 * vigente: una anulada (nota crédito) o con error vuelve a ser un pedido.
 */
export const esFacturaElectronica = (pedido) =>
  pedido?.ingefact_estado === "facturada" && !!pedido?.ingefact_numero_factura;

export const urlQrDian = (cufe) =>
  cufe ? URL_CONSULTA_DIAN + encodeURIComponent(cufe) : null;

/**
 * Medios de pago de la factura (la Edge Function la emite de contado). Sin
 * pagos registrados se asume efectivo, igual que hace la Edge Function.
 */
export const mediosDePago = (pedido) => {
  const nombres = new Set(
    (pedido?.pagos || [])
      .filter((p) => p.tipo !== "devolucion")
      .map((p) => p.metodo?.nombre || "Otro"),
  );
  return nombres.size ? [...nombres].join(", ") : "Efectivo";
};

/**
 * Líneas de identificación del emisor, ya filtradas: el nombre comercial va
 * como título solo si existe (sin dejar una línea vacía) y la razón social
 * siempre se muestra. Sin datos de empresa cargados se usa el nombre del
 * .env, como imprimía el sistema antes.
 */
export const datosEmisor = (empresa) => {
  const razonSocial = empresa?.razon_social?.trim() || NOMBRE_EMPRESA_POR_DEFECTO;
  const nombreComercial = empresa?.nombre_comercial?.trim() || null;

  const nit = empresa?.nit?.trim()
    ? `NIT ${empresa.nit.trim()}${empresa.digito_verificacion ? `-${empresa.digito_verificacion}` : ""}`
    : null;

  const direccion =
    [empresa?.direccion, empresa?.ciudad]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(" - ") || null;

  const contacto =
    [empresa?.telefono && `Tel: ${empresa.telefono.trim()}`, empresa?.correo?.trim()]
      .filter(Boolean)
      .join(" · ") || null;

  return {
    titulo: nombreComercial || razonSocial,
    // Si hay nombre comercial, la razón social va debajo; si no, ya es el
    // título y no se repite.
    razonSocial: nombreComercial ? razonSocial : null,
    lineas: [nit, direccion, contacto].filter(Boolean),
    resolucion: empresa?.resolucion_facturacion?.trim() || null,
  };
};

/**
 * Base gravable e impuestos del pedido, agrupados por tarifa. El precio de
 * cada línea ya incluye impuestos (ver crear_pedido_transaccional), así que
 * se descuentan: base = subtotal / (1 + (iva + inc) / 100). Solo devuelve
 * las tarifas que aplican, ordenadas IVA antes que INC y de mayor a menor.
 */
export const calcularTotales = (detalles = []) => {
  let subtotal = 0;
  const impuestos = new Map();

  const acumular = (tipo, tarifa, valor) => {
    if (tarifa <= 0) return;
    const clave = `${tipo} ${tarifa}%`;
    impuestos.set(clave, {
      etiqueta: clave,
      tipo,
      tarifa,
      valor: (impuestos.get(clave)?.valor || 0) + valor,
    });
  };

  detalles.forEach((item) => {
    const subtotalLinea = Number(item.subtotal_linea) || 0;
    const iva = Math.round(Number(item.iva_porcentaje) || 0);
    const inc = Math.round(Number(item.inc_porcentaje) || 0);
    const base = subtotalLinea / (1 + (iva + inc) / 100);

    subtotal += base;
    acumular("IVA", iva, base * (iva / 100));
    acumular("INC", inc, base * (inc / 100));
  });

  return {
    subtotal,
    impuestos: [...impuestos.values()].sort((a, b) =>
      a.tipo === b.tipo ? b.tarifa - a.tarifa : a.tipo === "IVA" ? -1 : 1,
    ),
  };
};
