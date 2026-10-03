import { describe, it, expect } from "vitest";
import { construirCotizacionHtml } from "./plantillaCotizacion";

const cotizacion = {
  numero_cotizacion: "7",
  fecha_cotizacion: "2026-10-03T15:00:00Z",
  fecha_vencimiento: "2026-10-18",
  total: 119000,
  notas: "Entrega en 3 días <b>hábiles</b>",
  cliente: {
    razon_social: "Tienda La Esquina SAS",
    tipo_identificacion: "NIT",
    numero_identificacion: "900123456",
    digito_verificacion: "1",
    direccion: "Calle 1 # 2-3",
  },
  usuario: { nombre_completo: "Ana Gerente" },
};

const detalles = [
  {
    cantidad: 2,
    precio_unitario: 59500,
    subtotal_linea: 119000,
    iva_porcentaje: 19,
    inc_porcentaje: 0,
    producto: { codigo: "A-1", nombre: "Arroz <script>" },
  },
];

describe("construirCotizacionHtml", () => {
  const html = construirCotizacionHtml(cotizacion, detalles, {
    empresa: { razon_social: "Mi Empresa SAS", nit: "800111222" },
  });

  it("muestra número, vigencia, cliente y emisor", () => {
    expect(html).toContain("N° 7");
    expect(html).toContain("Válida hasta: 18 de octubre de 2026");
    expect(html).toContain("Tienda La Esquina SAS");
    expect(html).toContain("NIT 900123456-1");
    expect(html).toContain("Mi Empresa SAS");
    expect(html).toContain("Ana Gerente");
  });

  it("desglosa el IVA contenido en el precio", () => {
    expect(html).toContain("IVA 19%");
    expect(html).toContain("TOTAL");
  });

  it("escapa texto de usuario", () => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>hábiles</b>");
    expect(html).toContain("&lt;b&gt;hábiles&lt;/b&gt;");
  });

  it("incluye el logo solo si se provee", () => {
    expect(html).not.toContain("<img");
    const conLogo = construirCotizacionHtml(cotizacion, detalles, {
      logoDataUrl: "data:image/png;base64,AAA",
    });
    expect(conLogo).toContain("data:image/png;base64,AAA");
  });
});
