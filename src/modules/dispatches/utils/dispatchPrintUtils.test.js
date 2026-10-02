import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  construirTiqueteDespachoHtml,
  imprimirTiqueteYFacturasDespacho,
} from "./dispatchPrintUtils";
import * as printUtils from "../../orders/utils/printUtils";

vi.mock("../../orders/utils/printUtils", async () => {
  const actual = await vi.importActual("../../orders/utils/printUtils");
  return {
    ...actual,
    generarPdfBlobUrl: vi.fn(),
    generarComprobantePdf: vi.fn(),
  };
});

vi.mock("../../orders/services/printService", () => ({
  printService: { obtenerContexto: vi.fn().mockResolvedValue({}) },
}));

const despacho = {
  codigo_despacho: "DES-0001",
  fecha_despacho: "2026-08-16T09:00:00Z",
  vehiculo: { placa: "ABC123", marca: "Chevrolet" },
  repartidor: { nombre_completo: "Carlos Ruiz" },
};

const pedidoA = {
  id: "pedido-a",
  numero_pedido: "10",
  total: 20000,
  clientes: {
    primer_nombre: "Ana",
    primer_apellido: "Gómez",
    direccion: "Calle 1",
  },
  detalles: [
    {
      producto_id: "p1",
      cantidad: 2,
      subtotal_linea: 10000,
      producto: { nombre: "Producto A" },
    },
    {
      producto_id: "p2",
      cantidad: 1,
      subtotal_linea: 10000,
      producto: { nombre: "Producto B" },
    },
  ],
};

const pedidoB = {
  id: "pedido-b",
  numero_pedido: "11",
  total: 15000,
  clientes: {
    primer_nombre: "Luis",
    primer_apellido: "Rojas",
    direccion: "Calle 2",
  },
  detalles: [
    {
      producto_id: "p1",
      cantidad: 3,
      subtotal_linea: 15000,
      producto: { nombre: "Producto A" },
    },
  ],
};

describe("construirTiqueteDespachoHtml", () => {
  it("agrega la cantidad del mismo producto entre varios pedidos en el resumen de cargue", () => {
    const html = construirTiqueteDespachoHtml(despacho, [pedidoA, pedidoB]);

    // Producto A: 2 (pedidoA) + 3 (pedidoB) = 5 en el resumen agregado
    expect(html).toMatch(/>5<\/span>[\s\S]{0,150}Producto A/);
  });

  it("incluye vehículo, repartidor y código de despacho en el encabezado", () => {
    const html = construirTiqueteDespachoHtml(despacho, [pedidoA]);

    expect(html).toContain("DES-0001");
    expect(html).toContain("ABC123");
    expect(html).toContain("Carlos Ruiz");
  });

  it("incluye el desglose por pedido con cliente y dirección de cada uno", () => {
    const html = construirTiqueteDespachoHtml(despacho, [pedidoA, pedidoB]);

    expect(html).toContain("Ana Gómez");
    expect(html).toContain("Calle 1");
    expect(html).toContain("Luis Rojas");
    expect(html).toContain("Calle 2");
  });

  it("suma el total de todos los pedidos incluidos", () => {
    const html = construirTiqueteDespachoHtml(despacho, [pedidoA, pedidoB]);

    // 20000 + 15000 = 35000
    expect(html).toMatch(/35[.,]?000/);
  });
});

describe("imprimirTiqueteYFacturasDespacho", () => {
  let createElementSpy;
  let clickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    printUtils.generarPdfBlobUrl.mockResolvedValue("blob:mock-url");
    printUtils.generarComprobantePdf.mockImplementation(async (pedido) => ({
      url: "blob:mock-url",
      nombreArchivo: `pedido-${pedido.numero_pedido}.pdf`,
    }));
    window.open = vi.fn();

    clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag) => {
        const el = realCreateElement(tag);
        if (tag === "a") el.click = clickSpy;
        return el;
      });
  });

  afterEach(() => {
    createElementSpy.mockRestore();
  });

  it("no hace nada si no hay pedidos en el despacho", async () => {
    await imprimirTiqueteYFacturasDespacho(despacho, []);

    expect(printUtils.generarPdfBlobUrl).not.toHaveBeenCalled();
    expect(printUtils.generarComprobantePdf).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("abre el tiquete de despacho en una pestaña nueva", async () => {
    await imprimirTiqueteYFacturasDespacho(despacho, [pedidoA]);

    expect(window.open).toHaveBeenCalledWith("blob:mock-url", "_blank");
  });

  it("genera un PDF por cada pedido y fuerza su descarga en vez de abrir pestañas", async () => {
    await imprimirTiqueteYFacturasDespacho(despacho, [pedidoA, pedidoB]);

    // 1 tiquete + 2 comprobantes
    expect(printUtils.generarPdfBlobUrl).toHaveBeenCalledTimes(1);
    expect(printUtils.generarComprobantePdf).toHaveBeenCalledTimes(2);
    // Solo se abre 1 pestaña (el tiquete); los comprobantes se descargan
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("nombra cada archivo con el código de despacho o el número de pedido correspondiente", async () => {
    await imprimirTiqueteYFacturasDespacho(despacho, [pedidoA, pedidoB]);

    expect(printUtils.generarPdfBlobUrl.mock.calls[0][1]).toBe(
      "tiquete-despacho-DES-0001.pdf",
    );
    const descargados = createElementSpy.mock.results
      .map((r) => r.value)
      .filter((el) => el.tagName === "A")
      .map((a) => a.download);
    expect(descargados).toEqual(["pedido-10.pdf", "pedido-11.pdf"]);
  });
});

describe("construirTiqueteDespachoHtml - saldo por cobrar", () => {
  it("no muestra abonos ni saldo cuando ningún pedido tiene abonos", () => {
    const html = construirTiqueteDespachoHtml(despacho, [
      { ...pedidoA, total_pagado: 0 },
    ]);
    expect(html).not.toContain("TOTAL POR COBRAR");
    expect(html).not.toContain("Por cobrar");
  });

  it("muestra lo abonado y el saldo de un pedido con abono parcial y suma el total por cobrar", () => {
    const html = construirTiqueteDespachoHtml(despacho, [
      { ...pedidoA, total_pagado: 5000 },
    ]);
    expect(html).toContain("Abonado");
    expect(html).toContain("TOTAL POR COBRAR");
  });
});
