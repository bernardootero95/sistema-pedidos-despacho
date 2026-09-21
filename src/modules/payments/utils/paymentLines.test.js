import { describe, it, expect } from "vitest";
import {
  MODOS_PAGO,
  crearLinea,
  lineasAPayload,
  parseMonto,
  sumarLineas,
  validarCampoLinea,
  validarLineas,
} from "./paymentLines";

const linea = (metodo, monto) => ({ ...crearLinea(monto), metodo_pago_id: metodo });
const conMetodos = { metodosActivo: true };

describe("parseMonto", () => {
  it("acepta coma decimal y devuelve NaN si está vacío", () => {
    expect(parseMonto("1500,5")).toBe(1500.5);
    expect(parseMonto("")).toBeNaN();
  });
});

describe("sumarLineas", () => {
  it("ignora montos vacíos, inválidos o negativos", () => {
    const lineas = [linea("a", "1000"), linea("b", ""), linea("c", "-5"), linea("d", "abc")];
    expect(sumarLineas(lineas)).toBe(1000);
  });
});

describe("validarCampoLinea", () => {
  it("exige método solo cuando los métodos de pago están activos", () => {
    const l = linea("", "100");
    const ctx = { ...conMetodos, lineas: [l], modo: MODOS_PAGO.EXACTO, objetivo: 100 };
    expect(validarCampoLinea("metodo_pago_id", l, ctx)).toBe("Selecciona el método.");
    expect(validarCampoLinea("metodo_pago_id", l, { ...ctx, metodosActivo: false })).toBe("");
  });

  it("rechaza un método repetido en otra línea", () => {
    const a = linea("m1", "100");
    const b = linea("m1", "50");
    const ctx = { ...conMetodos, lineas: [a, b], modo: MODOS_PAGO.MAXIMO, objetivo: 500 };
    expect(validarCampoLinea("metodo_pago_id", b, ctx)).toMatch(/repetido/i);
  });

  it("exige un monto mayor a 0", () => {
    const ctx = { ...conMetodos, lineas: [], modo: MODOS_PAGO.EXACTO, objetivo: 100 };
    expect(validarCampoLinea("monto", linea("m", ""), ctx)).toBe("Ingresa el monto.");
    expect(validarCampoLinea("monto", linea("m", "0"), ctx)).toBe("El monto debe ser mayor a 0.");
    expect(validarCampoLinea("monto", linea("m", "10"), ctx)).toBe("");
  });

  it("en modo opcional una línea totalmente vacía no da error", () => {
    const l = linea("", "");
    const ctx = { ...conMetodos, lineas: [l], modo: MODOS_PAGO.OPCIONAL, objetivo: 100 };
    expect(validarCampoLinea("monto", l, ctx)).toBe("");
    expect(validarCampoLinea("metodo_pago_id", l, ctx)).toBe("");
  });
});

describe("validarLineas", () => {
  it("exacto: acepta la suma justa y rechaza faltante o exceso", () => {
    const ctx = { ...conMetodos, modo: MODOS_PAGO.EXACTO, objetivo: 10000 };
    expect(validarLineas([linea("a", "6000"), linea("b", "4000")], ctx).valido).toBe(true);
    expect(validarLineas([linea("a", "6000")], ctx).general).toMatch(/Falta cubrir/);
    expect(validarLineas([linea("a", "11000")], ctx).general).toMatch(/Excede/);
  });

  it("maximo: exige al menos un pago y no permite superar el saldo", () => {
    const ctx = { metodosActivo: false, modo: MODOS_PAGO.MAXIMO, objetivo: 5000 };
    expect(validarLineas([linea("", "2000")], ctx).valido).toBe(true);
    expect(validarLineas([linea("", "6000")], ctx).general).toMatch(/Excede/);
    expect(validarLineas([], ctx).general).toBe("Registra al menos un pago.");
  });

  it("opcional: permite no pagar nada pero no superar el total", () => {
    const ctx = { ...conMetodos, modo: MODOS_PAGO.OPCIONAL, objetivo: 5000 };
    expect(validarLineas([linea("", "")], ctx).valido).toBe(true);
    expect(validarLineas([], ctx).valido).toBe(true);
    expect(validarLineas([linea("a", "9000")], ctx).general).toMatch(/Excede/);
  });

  it("los errores de línea tienen prioridad sobre el error general", () => {
    const ctx = { ...conMetodos, modo: MODOS_PAGO.EXACTO, objetivo: 100 };
    const resultado = validarLineas([linea("", "100")], ctx);
    expect(resultado.valido).toBe(false);
    expect(resultado.general).toBe("");
    expect(Object.values(resultado.porLinea)[0].metodo_pago_id).toBeTruthy();
  });

  it("tolera el ruido de punto flotante al sumar decimales", () => {
    const ctx = { ...conMetodos, modo: MODOS_PAGO.EXACTO, objetivo: 0.3 };
    expect(validarLineas([linea("a", "0.1"), linea("b", "0.2")], ctx).valido).toBe(true);
  });
});

describe("lineasAPayload", () => {
  it("omite líneas sin monto y manda método null cuando no hay", () => {
    const lineas = [linea("m1", "1000"), linea("", "500"), linea("m3", "")];
    expect(lineasAPayload(lineas)).toEqual([
      { metodo_pago_id: "m1", monto: 1000 },
      { metodo_pago_id: null, monto: 500 },
    ]);
  });
});
