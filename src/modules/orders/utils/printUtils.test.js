import { describe, it, expect } from "vitest";
import { formatCurrencyPdf, construirComprobantePedidoHtml } from "./printUtils";

describe("formatCurrencyPdf", () => {
  it("formatea un monto como pesos colombianos", () => {
    expect(formatCurrencyPdf(15000)).toMatch(/15[.,]?000/);
  });

  it("trata null/undefined como 0", () => {
    expect(formatCurrencyPdf(null)).toBe(formatCurrencyPdf(0));
    expect(formatCurrencyPdf(undefined)).toBe(formatCurrencyPdf(0));
  });
});

describe("construirComprobantePedidoHtml", () => {
  const pedidoCompleto = {
    numero_pedido: "42",
    fecha_pedido: "2026-08-16T10:00:00Z",
    total: 11900,
    notas: "Entregar en la tarde",
    clientes: {
      razon_social: "",
      primer_nombre: "Ana",
      primer_apellido: "Gómez",
      tipo_identificacion: "CC",
      numero_identificacion: "123456789",
      direccion: "Calle 1 # 2-3",
    },
    vendedor: { nombre_completo: "Juan Pérez" },
    detalles: [
      {
        cantidad: 2,
        precio_unitario: 5000,
        subtotal_linea: 10000,
        iva_porcentaje: 19,
        inc_porcentaje: 0,
        producto: { nombre: "Producto A" },
      },
    ],
  };

  it("incluye el número de pedido, el cliente y las líneas del pedido", () => {
    const html = construirComprobantePedidoHtml(pedidoCompleto);

    expect(html).toContain("42");
    expect(html).toContain("Ana Gómez");
    expect(html).toContain("Producto A");
    expect(html).toContain("123456789");
  });

  it("incluye las notas solo cuando el pedido las tiene", () => {
    const conNotas = construirComprobantePedidoHtml(pedidoCompleto);
    expect(conNotas).toContain("Entregar en la tarde");

    const sinNotas = construirComprobantePedidoHtml({
      ...pedidoCompleto,
      notas: "",
    });
    expect(sinNotas).not.toContain("Notas:");
  });
});
