import { describe, it, expect } from "vitest";
import {
  validateProductField,
  validateTierMayorista,
} from "./productValidations";

describe("validateProductField: precio_frio", () => {
  it("es opcional", () => {
    expect(validateProductField("precio_frio", "")).toBe("");
    expect(validateProductField("precio_frio", null)).toBe("");
  });

  it("rechaza valores negativos", () => {
    expect(validateProductField("precio_frio", "-100")).toBe(
      "El precio no puede ser negativo.",
    );
  });

  it("acepta un precio válido", () => {
    expect(validateProductField("precio_frio", "4500")).toBe("");
  });
});

describe("validateProductField: precio_credito", () => {
  it("es opcional", () => {
    expect(validateProductField("precio_credito", "")).toBe("");
    expect(validateProductField("precio_credito", null)).toBe("");
  });

  it("rechaza valores negativos", () => {
    expect(validateProductField("precio_credito", "-100")).toBe(
      "El precio no puede ser negativo.",
    );
  });

  it("acepta un precio válido", () => {
    expect(validateProductField("precio_credito", "6000")).toBe("");
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
