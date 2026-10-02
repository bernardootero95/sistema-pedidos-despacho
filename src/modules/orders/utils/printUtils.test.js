import { describe, it, expect } from "vitest";
import { formatCurrencyPdf } from "./printUtils";
import { construirTirillaHtml } from "./print/plantillaTirilla";

describe("formatCurrencyPdf", () => {
  it("formatea un monto como pesos colombianos", () => {
    expect(formatCurrencyPdf(15000)).toMatch(/15[.,]?000/);
  });

  it("trata null/undefined como 0", () => {
    expect(formatCurrencyPdf(null)).toBe(formatCurrencyPdf(0));
    expect(formatCurrencyPdf(undefined)).toBe(formatCurrencyPdf(0));
  });
});

describe("construirTirillaHtml (pedido)", () => {
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
    const html = construirTirillaHtml(pedidoCompleto);

    expect(html).toContain("42");
    expect(html).toContain("Ana Gómez");
    expect(html).toContain("Producto A");
    expect(html).toContain("123456789");
  });

  it("no agrega bloque de pagos si el pedido se pagó solo en efectivo", () => {
    const html = construirTirillaHtml({
      ...pedidoCompleto,
      pagos: [
        { tipo: "entrega", monto: 11900, metodo: { nombre: "Efectivo", es_efectivo: true } },
      ],
    });
    expect(html).not.toContain("PAGOS:");
  });

  it("muestra los pagos por método y el saldo por cobrar cuando hay abonos", () => {
    const html = construirTirillaHtml({
      ...pedidoCompleto,
      pagos: [
        { tipo: "abono", monto: 5000, metodo: { nombre: "Transferencia", es_efectivo: false } },
      ],
    });
    expect(html).toContain("PAGOS:");
    expect(html).toContain("Transferencia:");
    expect(html).toContain("SALDO POR COBRAR:");
  });

  it("incluye las notas solo cuando el pedido las tiene", () => {
    const conNotas = construirTirillaHtml(pedidoCompleto);
    expect(conNotas).toContain("Entregar en la tarde");

    const sinNotas = construirTirillaHtml({
      ...pedidoCompleto,
      notas: "",
    });
    expect(sinNotas).not.toContain("Notas:");
  });
});
