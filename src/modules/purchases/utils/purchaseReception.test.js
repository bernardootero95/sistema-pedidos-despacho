import { describe, it, expect } from "vitest";
import {
  ESTADOS_RECEPCION,
  fechaIsoDe,
  getEtiquetaRecepcion,
  puedeRecibirse,
} from "./purchaseReception";
import {
  validateFechaRecepcion,
  validatePurchaseField,
  validatePurchaseForm,
} from "./purchaseValidations";

describe("puedeRecibirse", () => {
  it("solo una compra registrada y pendiente se puede recibir", () => {
    expect(puedeRecibirse({ estado: "registrada", estado_recepcion: "pendiente" })).toBe(true);
    expect(puedeRecibirse({ estado: "registrada", estado_recepcion: "recibida" })).toBe(false);
    expect(puedeRecibirse({ estado: "anulada", estado_recepcion: "pendiente" })).toBe(false);
    expect(puedeRecibirse(null)).toBe(false);
  });
});

describe("etiquetas y fechas", () => {
  it("traduce el estado de recepción a su etiqueta", () => {
    expect(getEtiquetaRecepcion("pendiente")).toBe("Pendiente");
    expect(getEtiquetaRecepcion("recibida")).toBe("Recibida");
    expect(getEtiquetaRecepcion("otro")).toBe("otro");
  });

  it("fechaIsoDe toma la fecha UTC del timestamp guardado", () => {
    expect(fechaIsoDe("2026-11-19T00:00:00+00:00")).toBe("2026-11-19");
    expect(fechaIsoDe(null)).toBe("");
  });
});

describe("validación del estado de recepción en el formulario", () => {
  it("acepta recibida y pendiente, rechaza otros valores", () => {
    expect(validatePurchaseField("estado_recepcion", ESTADOS_RECEPCION.RECIBIDA)).toBe("");
    expect(validatePurchaseField("estado_recepcion", ESTADOS_RECEPCION.PENDIENTE)).toBe("");
    expect(validatePurchaseField("estado_recepcion", "")).not.toBe("");
    expect(validatePurchaseField("estado_recepcion", "en_camino")).not.toBe("");
  });

  it("el formulario completo reporta el estado de recepción inválido", () => {
    const errores = validatePurchaseForm(
      { proveedor_id: "p1", fecha_compra: "2026-01-01", estado_recepcion: "" },
      [{ producto_id: "x" }],
    );
    expect(Object.keys(errores)).toEqual(["estado_recepcion"]);
  });
});

describe("validateFechaRecepcion", () => {
  const hoy = "2026-11-21";
  const fechaCompra = "2026-11-18T00:00:00+00:00";

  it("es obligatoria", () => {
    expect(validateFechaRecepcion("", fechaCompra, hoy)).toMatch(/obligatoria/);
  });

  it("no puede ser futura", () => {
    expect(validateFechaRecepcion("2026-11-22", fechaCompra, hoy)).toMatch(/futura/);
  });

  it("no puede ser anterior a la compra", () => {
    expect(validateFechaRecepcion("2026-11-17", fechaCompra, hoy)).toMatch(/anterior/);
  });

  it("acepta el mismo día de la compra y hoy", () => {
    expect(validateFechaRecepcion("2026-11-18", fechaCompra, hoy)).toBe("");
    expect(validateFechaRecepcion(hoy, fechaCompra, hoy)).toBe("");
  });

  it("acepta el mismo día aunque la compra se guardó con hora", () => {
    expect(validateFechaRecepcion("2026-11-18", "2026-11-18T15:30:00+00:00", hoy)).toBe("");
  });
});
