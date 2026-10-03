import { describe, it, expect } from "vitest";
import {
  ESTADOS_PEDIDO,
  ETIQUETAS_ESTADO_PEDIDO,
  ESTILOS_ESTADO_PEDIDO,
  getEtiquetaEstadoPedido,
  getEstiloEstadoPedido,
} from "./orderConstants";

describe("ESTADOS_PEDIDO", () => {
  it("refleja los estados que escriben los RPC de pedidos_cabecera", () => {
    expect(ESTADOS_PEDIDO).toEqual(["pendiente", "despachado", "entregado", "devuelto", "anulado"]);
  });

  it("no incluye 'en_ruta' (es un estado de despachos, no de pedidos)", () => {
    expect(ESTADOS_PEDIDO).not.toContain("en_ruta");
  });

  it("todo estado tiene etiqueta y estilo propios", () => {
    ESTADOS_PEDIDO.forEach((estado) => {
      expect(ETIQUETAS_ESTADO_PEDIDO[estado]).toBeTruthy();
      expect(ESTILOS_ESTADO_PEDIDO[estado]).toBeTruthy();
    });
  });
});

describe("getEtiquetaEstadoPedido", () => {
  it("traduce estados conocidos sin importar mayúsculas", () => {
    expect(getEtiquetaEstadoPedido("despachado")).toBe("Despachado");
    expect(getEtiquetaEstadoPedido("DEVUELTO")).toBe("Devuelto");
  });

  it("devuelve el valor crudo si el estado es desconocido, y vacío si no hay", () => {
    expect(getEtiquetaEstadoPedido("otro_estado")).toBe("otro_estado");
    expect(getEtiquetaEstadoPedido(undefined)).toBe("");
  });
});

describe("getEstiloEstadoPedido", () => {
  it("usa el estilo del estado o un gris neutro por defecto", () => {
    expect(getEstiloEstadoPedido("devuelto")).toBe(ESTILOS_ESTADO_PEDIDO.devuelto);
    expect(getEstiloEstadoPedido("en_ruta")).toContain("bg-slate-100");
    expect(getEstiloEstadoPedido(null)).toContain("bg-slate-100");
  });
});
