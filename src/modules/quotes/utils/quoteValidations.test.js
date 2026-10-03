import { describe, it, expect } from "vitest";
import { validateQuoteField, validateQuoteForm } from "./quoteValidations";
import { hoyIso, sumarDiasIso } from "./quoteStatus";

const linea = { producto_id: "p1", nombre: "Arroz", cantidad: 2, precio_unitario: 1000 };
const manana = sumarDiasIso(hoyIso(), 1);

describe("validateQuoteField", () => {
  it("exige cliente", () => {
    expect(validateQuoteField("cliente_id", "")).not.toBe("");
    expect(validateQuoteField("cliente_id", "c1")).toBe("");
  });

  it("rechaza vencimiento vacío o pasado y acepta hoy o futuro", () => {
    expect(validateQuoteField("fecha_vencimiento", "")).not.toBe("");
    expect(validateQuoteField("fecha_vencimiento", sumarDiasIso(hoyIso(), -1))).not.toBe("");
    expect(validateQuoteField("fecha_vencimiento", hoyIso())).toBe("");
    expect(validateQuoteField("fecha_vencimiento", manana)).toBe("");
  });

  it("ignora campos sin validador", () => {
    expect(validateQuoteField("notas", "x")).toBe("");
  });
});

describe("validateQuoteForm", () => {
  it("sin errores con cabecera y líneas válidas", () => {
    expect(
      validateQuoteForm({ cliente_id: "c1", fecha_vencimiento: manana }, [linea]),
    ).toEqual({});
  });

  it("reporta cliente, fecha y carrito vacío, hablando de cotización", () => {
    const errors = validateQuoteForm({ cliente_id: "", fecha_vencimiento: "" }, []);
    expect(Object.keys(errors).sort()).toEqual(["carrito", "cliente_id", "fecha_vencimiento"]);
    expect(errors.carrito).toMatch(/cotización/i);
  });

  it("rechaza cantidades que no son cuartos de unidad", () => {
    const errors = validateQuoteForm(
      { cliente_id: "c1", fecha_vencimiento: manana },
      [{ ...linea, cantidad: 1.3 }],
    );
    expect(errors.carrito).toBeTruthy();
  });
});
