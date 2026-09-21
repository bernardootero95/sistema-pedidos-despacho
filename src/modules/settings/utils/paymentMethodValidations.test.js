import { describe, it, expect } from "vitest";
import {
  validatePaymentMethodField,
  validatePaymentMethodForm,
} from "./paymentMethodValidations";

describe("validatePaymentMethodField", () => {
  it("exige nombre", () => {
    expect(validatePaymentMethodField("nombre", "   ")).toBe(
      "El nombre es obligatorio.",
    );
  });

  it("limita el nombre a 50 caracteres", () => {
    expect(validatePaymentMethodField("nombre", "a".repeat(51))).toBe(
      "Máximo 50 caracteres.",
    );
    expect(validatePaymentMethodField("nombre", "a".repeat(50))).toBe("");
  });

  it("acepta solo códigos DIAN conocidos", () => {
    expect(validatePaymentMethodField("codigo_dian", "")).not.toBe("");
    expect(validatePaymentMethodField("codigo_dian", "99")).not.toBe("");
    expect(validatePaymentMethodField("codigo_dian", "47")).toBe("");
    expect(validatePaymentMethodField("codigo_dian", "ZZZ")).toBe("");
  });

  it("ignora campos sin validador", () => {
    expect(validatePaymentMethodField("otro", "x")).toBe("");
  });
});

describe("validatePaymentMethodForm", () => {
  it("devuelve un error por cada campo inválido", () => {
    expect(
      Object.keys(validatePaymentMethodForm({ nombre: "", codigo_dian: "" })),
    ).toEqual(["nombre", "codigo_dian"]);
  });

  it("no devuelve errores con datos válidos", () => {
    expect(
      validatePaymentMethodForm({ nombre: "Transferencia", codigo_dian: "47" }),
    ).toEqual({});
  });
});
