import { describe, it, expect } from "vitest";
import {
  validatePrecioPersonalizado,
  validateTierMayorista,
} from "./productValidations";

describe("validatePrecioPersonalizado", () => {
  it("es opcional", () => {
    expect(validatePrecioPersonalizado("")).toBe("");
    expect(validatePrecioPersonalizado(null)).toBe("");
    expect(validatePrecioPersonalizado(undefined)).toBe("");
  });

  it("rechaza valores negativos", () => {
    expect(validatePrecioPersonalizado("-100")).toBe(
      "El precio no puede ser negativo.",
    );
  });

  it("rechaza texto que no es un número", () => {
    expect(validatePrecioPersonalizado("abc")).toBe(
      "Ingresa un número válido.",
    );
  });

  it("acepta un precio válido, incluido 0", () => {
    expect(validatePrecioPersonalizado("4500")).toBe("");
    expect(validatePrecioPersonalizado("0")).toBe("");
  });
});

describe("validateTierMayorista", () => {
  it("exige cantidad_minima mayor a 0", () => {
    const errores = validateTierMayorista({ cantidad_minima: "0", precio: "100" });
    expect(errores.cantidad_minima).toBe("Ingresa una cantidad mayor a 0.");
  });

  it("exige un precio válido (0 o mayor)", () => {
    const errores = validateTierMayorista({
      cantidad_minima: "10",
      precio: "-5",
    });
    expect(errores.precio).toBe("Ingresa un precio válido (0 o mayor).");
  });

  it("no reporta errores para una franja válida y sin duplicados", () => {
    const errores = validateTierMayorista(
      { cantidad_minima: "10", precio: "900" },
      [{ cantidad_minima: "50", precio: "850" }],
    );
    expect(errores).toEqual({});
  });

  it("detecta cantidad_minima duplicada entre franjas", () => {
    const errores = validateTierMayorista(
      { cantidad_minima: "10", precio: "900" },
      [{ cantidad_minima: "10", precio: "850" }],
    );
    expect(errores.cantidad_minima).toBe(
      "Ya existe una franja con esa cantidad.",
    );
  });
});
