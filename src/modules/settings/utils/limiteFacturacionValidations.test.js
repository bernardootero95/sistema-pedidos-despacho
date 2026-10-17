import { describe, it, expect } from "vitest";
import {
  validateLimiteFacturacionField,
  validateLimiteFacturacionForm,
} from "./limiteFacturacionValidations";

describe("validateLimiteFacturacionField", () => {
  it("acepta solo tipos conocidos", () => {
    expect(validateLimiteFacturacionField("tipo", "semanal")).not.toBe("");
    expect(validateLimiteFacturacionField("tipo", "mensual")).toBe("");
  });

  it("exige valor cuando hay límite", () => {
    expect(validateLimiteFacturacionField("valor", "", { tipo: "diaria" })).toBe(
      "El valor del límite es obligatorio.",
    );
  });

  it("rechaza cero, negativos y no numéricos", () => {
    for (const v of ["0", "-5", "abc"]) {
      expect(validateLimiteFacturacionField("valor", v, { tipo: "mensual" })).toBe(
        "Ingresa un valor mayor a 0.",
      );
    }
  });

  it("no exige valor si es ilimitada", () => {
    expect(validateLimiteFacturacionField("valor", "", { tipo: "ilimitada" })).toBe("");
  });
});

describe("validateLimiteFacturacionForm", () => {
  it("valida el formulario completo", () => {
    expect(validateLimiteFacturacionForm({ tipo: "mensual", valor: "" })).toEqual({
      valor: "El valor del límite es obligatorio.",
    });
    expect(validateLimiteFacturacionForm({ tipo: "mensual", valor: "5000000" })).toEqual({});
    expect(validateLimiteFacturacionForm({ tipo: "ilimitada", valor: "" })).toEqual({});
  });
});
