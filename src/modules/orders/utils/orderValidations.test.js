import { describe, it, expect } from "vitest";
import {
  esFraccionValida,
  redondearACantidadValida,
  puedeAnularPedido,
  puedeEntregarSinDespacho,
  parsePrecioManual,
  validators,
} from "./orderValidations";

describe("esFraccionValida", () => {
  it("acepta enteros y cuartos de unidad", () => {
    expect(esFraccionValida(1)).toBe(true);
    expect(esFraccionValida(0.25)).toBe(true);
    expect(esFraccionValida(0.5)).toBe(true);
    expect(esFraccionValida(0.75)).toBe(true);
    expect(esFraccionValida(2.5)).toBe(true);
  });

  it("rechaza fracciones distintas de .25/.5/.75", () => {
    expect(esFraccionValida(1.3)).toBe(false);
    expect(esFraccionValida(0.1)).toBe(false);
    expect(esFraccionValida(2.6)).toBe(false);
  });
});

describe("redondearACantidadValida", () => {
  it("redondea al cuarto de unidad más cercano", () => {
    expect(redondearACantidadValida(1.3)).toBe(1.25);
    expect(redondearACantidadValida(1.4)).toBe(1.5);
    expect(redondearACantidadValida(1.1)).toBe(1);
  });

  it("no altera valores que ya son válidos", () => {
    expect(redondearACantidadValida(2.5)).toBe(2.5);
    expect(redondearACantidadValida(3)).toBe(3);
  });
});

describe("validators.carrito: rechaza fracciones no permitidas", () => {
  it("reporta error si una línea tiene una fracción inválida", () => {
    const carrito = [
      {
        producto_id: "p1",
        nombre: "Producto 1",
        cantidad: 1.3,
        precio_unitario: 1000,
      },
    ];
    expect(validators.carrito(carrito)).toMatch(/fracción \.25, \.5 o \.75/);
  });

  it("no reporta error para fracciones válidas", () => {
    const carrito = [
      {
        producto_id: "p1",
        nombre: "Producto 1",
        cantidad: 1.75,
        precio_unitario: 1000,
      },
    ];
    expect(validators.carrito(carrito)).toBe("");
  });
});

describe("puedeAnularPedido", () => {
  const pedidoPendientePropio = { estado: "pendiente", vendedor_id: "v1" };
  const pedidoDespachado = { estado: "despachado", vendedor_id: "v1" };
  const pedidoAnulado = { estado: "anulado", vendedor_id: "v1" };

  it.each(["gerencia", "soporte", "despachador"])(
    "%s puede anular cualquier pedido no anulado, sin importar el dueño",
    (rol) => {
      const user = { id: "otro", rol };
      expect(puedeAnularPedido(pedidoPendientePropio, user)).toBe(true);
      expect(puedeAnularPedido(pedidoDespachado, user)).toBe(true);
    },
  );

  it.each(["gerencia", "soporte", "despachador"])(
    "%s no puede anular un pedido ya anulado",
    (rol) => {
      expect(puedeAnularPedido(pedidoAnulado, { id: "otro", rol })).toBe(false);
    },
  );

  it("vendedor puede anular su propio pedido pendiente", () => {
    const user = { id: "v1", rol: "vendedor" };
    expect(puedeAnularPedido(pedidoPendientePropio, user)).toBe(true);
  });

  it("vendedor no puede anular el pedido de otro vendedor", () => {
    const user = { id: "v2", rol: "vendedor" };
    expect(puedeAnularPedido(pedidoPendientePropio, user)).toBe(false);
  });

  it("vendedor no puede anular su propio pedido si ya no está pendiente", () => {
    const user = { id: "v1", rol: "vendedor" };
    expect(puedeAnularPedido(pedidoDespachado, user)).toBe(false);
  });

  it("repartidor no puede anular ningún pedido", () => {
    const user = { id: "otro", rol: "repartidor" };
    expect(puedeAnularPedido(pedidoPendientePropio, user)).toBe(false);
  });
});

describe("puedeEntregarSinDespacho", () => {
  it.each(["soporte", "gerencia", "despachador"])(
    "%s puede entregar un pedido pendiente",
    (rol) => {
      expect(puedeEntregarSinDespacho({ estado: "pendiente" }, { rol })).toBe(true);
    },
  );

  it.each(["vendedor", "cajera", "repartidor"])("%s no puede", (rol) => {
    expect(puedeEntregarSinDespacho({ estado: "pendiente" }, { rol })).toBe(false);
  });

  it.each(["despachado", "entregado", "anulado", "devuelto"])(
    "no aplica a un pedido %s",
    (estado) => {
      expect(puedeEntregarSinDespacho({ estado }, { rol: "soporte" })).toBe(false);
    },
  );
});

describe("precio manual", () => {
  it("acepta enteros, 0 y hasta 2 decimales con punto o coma", () => {
    expect(validators.precioManual("1500")).toBe("");
    expect(validators.precioManual("0")).toBe("");
    expect(validators.precioManual("1500,5")).toBe("");
    expect(validators.precioManual("1500.25")).toBe("");
  });

  it("rechaza vacío, texto, negativos, más de 2 decimales y valores enormes", () => {
    expect(validators.precioManual("")).not.toBe("");
    expect(validators.precioManual("abc")).not.toBe("");
    expect(validators.precioManual("-5")).not.toBe("");
    expect(validators.precioManual("1.234")).not.toBe("");
    expect(validators.precioManual("99999999999")).not.toBe("");
  });

  it("parsePrecioManual convierte la coma decimal y devuelve NaN si no es válido", () => {
    expect(parsePrecioManual("1500,5")).toBe(1500.5);
    expect(parsePrecioManual("x")).toBeNaN();
  });
});
