import { describe, it, expect } from "vitest";
import {
  MAX_MENSAJE_PIE,
  validateInvoiceFooterField,
  validateInvoiceFooterForm,
} from "./invoiceFooterValidations";

describe("validateInvoiceFooterForm", () => {
  it("exige el mensaje y no acepta solo espacios", () => {
    const esperado = { mensaje: "El mensaje es obligatorio." };
    expect(validateInvoiceFooterForm({ mensaje: "" })).toEqual(esperado);
    expect(validateInvoiceFooterForm({ mensaje: "   " })).toEqual(esperado);
    expect(validateInvoiceFooterForm({ mensaje: "20% de descuento" })).toEqual({});
  });

  it("limita la longitud al máximo permitido", () => {
    expect(
      validateInvoiceFooterField("mensaje", "a".repeat(MAX_MENSAJE_PIE)),
    ).toBe("");
    expect(
      validateInvoiceFooterField("mensaje", "a".repeat(MAX_MENSAJE_PIE + 1)),
    ).toBe(`Máximo ${MAX_MENSAJE_PIE} caracteres.`);
  });
});
