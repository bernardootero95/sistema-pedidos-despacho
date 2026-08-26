import { describe, it, expect } from "vitest";
import {
  esFraccionValida,
  redondearACantidadValida,
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
