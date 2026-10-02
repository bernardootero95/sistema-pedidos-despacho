import { describe, it, expect } from "vitest";
import { construirTirillaHtml } from "./plantillaTirilla";
import { construirCartaHtml } from "./plantillaCarta";
import {
  datosEmisor,
  calcularTotales,
  esFacturaElectronica,
  urlQrDian,
} from "./comprobanteDatos";

const empresa = {
  razon_social: "Distribuciones Ejemplo S.A.S.",
  nombre_comercial: "La Tienda",
  nit: "900123456",
  digito_verificacion: "7",
  direccion: "Cra 1 # 2-3",
  ciudad: "Bogotá",
  telefono: "3001234567",
  correo: "ventas@ejemplo.co",
  resolucion_facturacion: "Resolución DIAN 18764000001 prefijo FE del 1 al 1000",
};

const pedido = {
  numero_pedido: "42",
  fecha_pedido: "2026-08-16T10:00:00Z",
  total: 11900,
  clientes: {
    razon_social: "Cliente S.A.S.",
    tipo_identificacion: "NIT",
    numero_identificacion: "800111222",
  },
  vendedor: { nombre_completo: "Juan Pérez" },
  detalles: [
    {
      cantidad: 2,
      precio_unitario: 5950,
      subtotal_linea: 11900,
      iva_porcentaje: 19,
      inc_porcentaje: 0,
      producto: { codigo: "00001", nombre: "Producto <A>" },
    },
  ],
};

const facturado = {
  ...pedido,
  ingefact_estado: "facturada",
  ingefact_numero_factura: "FE-15",
  ingefact_enviado_en: "2026-08-17T10:00:00Z",
  ingefact_cufe: "abc123cufe",
};

const contexto = {
  empresa,
  logoDataUrl: "data:image/png;base64,LOGO",
  qrDataUrl: "data:image/png;base64,QR",
};

describe("datosEmisor", () => {
  it("usa el nombre comercial como título y la razón social debajo", () => {
    const emisor = datosEmisor(empresa);
    expect(emisor.titulo).toBe("La Tienda");
    expect(emisor.razonSocial).toBe("Distribuciones Ejemplo S.A.S.");
    expect(emisor.lineas[0]).toBe("NIT 900123456-7");
  });

  it("sin nombre comercial la razón social es el título y no se repite", () => {
    const emisor = datosEmisor({ ...empresa, nombre_comercial: "  " });
    expect(emisor.titulo).toBe("Distribuciones Ejemplo S.A.S.");
    expect(emisor.razonSocial).toBeNull();
  });

  it("omite las líneas sin datos", () => {
    const emisor = datosEmisor({ razon_social: "Solo Razón" });
    expect(emisor.lineas).toEqual([]);
  });
});

describe("calcularTotales", () => {
  it("descuenta el impuesto incluido y agrupa por tarifa", () => {
    const { subtotal, impuestos } = calcularTotales(pedido.detalles);
    expect(subtotal).toBeCloseTo(10000);
    expect(impuestos).toEqual([
      expect.objectContaining({ etiqueta: "IVA 19%", valor: expect.closeTo(1900) }),
    ]);
  });
});

describe("esFacturaElectronica / urlQrDian", () => {
  it("solo con factura vigente", () => {
    expect(esFacturaElectronica(facturado)).toBe(true);
    expect(esFacturaElectronica({ ...facturado, ingefact_estado: "anulada" })).toBe(false);
    expect(esFacturaElectronica(pedido)).toBe(false);
  });

  it("arma la URL de consulta DIAN por CUFE", () => {
    expect(urlQrDian("abc")).toContain("documentkey=abc");
    expect(urlQrDian(null)).toBeNull();
  });
});

describe.each([
  ["tirilla", construirTirillaHtml],
  ["carta", construirCartaHtml],
])("diseño %s", (_, construir) => {
  it("pedido: muestra nombre comercial, razón social y logo, sin datos de factura", () => {
    const html = construir(pedido, contexto);
    expect(html).toContain("La Tienda");
    expect(html).toContain("Distribuciones Ejemplo S.A.S.");
    expect(html).toContain("data:image/png;base64,LOGO");
    expect(html).not.toContain("CUFE");
    expect(html).not.toContain("FE-15");
  });

  it("sin logo no deja la imagen", () => {
    const html = construir(pedido, { empresa });
    expect(html).not.toContain("<img");
  });

  it("factura electrónica: número, CUFE, QR y resolución", () => {
    const html = construir(facturado, contexto);
    expect(html).toMatch(/FACTURA ELECTR[OÓ]NICA DE VENTA/i);
    expect(html).toContain("FE-15");
    expect(html).toContain("abc123cufe");
    expect(html).toContain("data:image/png;base64,QR");
    expect(html).toContain("Resolución DIAN 18764000001");
  });

  it("escapa el texto de usuario", () => {
    const html = construir(pedido, contexto);
    expect(html).toContain("Producto &lt;A&gt;");
  });
});
