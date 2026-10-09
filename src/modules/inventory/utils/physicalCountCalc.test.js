import { describe, expect, it } from "vitest";
import { cruzarConteosImportados, diferenciaFila, parseCantidadContada, resumirToma } from "./physicalCountCalc";
import { validatePhysicalCountEntries, validatePhysicalCountField } from "./physicalCountValidations";

describe("parseCantidadContada", () => {
  it("trata vacío como no contado", () => {
    expect(parseCantidadContada("")).toBeNull();
    expect(parseCantidadContada("  ")).toBeNull();
    expect(parseCantidadContada(null)).toBeNull();
  });

  it("acepta punto y coma decimal", () => {
    expect(parseCantidadContada("12.5")).toBe(12.5);
    expect(parseCantidadContada("12,5")).toBe(12.5);
    expect(parseCantidadContada(7)).toBe(7);
  });

  it("rechaza negativos y texto", () => {
    expect(parseCantidadContada("-1")).toBeNaN();
    expect(parseCantidadContada("abc")).toBeNaN();
  });
});

describe("diferenciaFila", () => {
  it("es contado − sistema y evita ruido de coma flotante", () => {
    expect(diferenciaFila(10, 8)).toBe(-2);
    expect(diferenciaFila(0.1, 0.3)).toBe(0.2);
    expect(diferenciaFila(10, null)).toBeNull();
  });
});

describe("resumirToma", () => {
  const filas = [
    { productoId: "a", cantidadSistema: 10, costoUnitario: 100, precioVenta: 150 },
    { productoId: "b", cantidadSistema: 5, costoUnitario: null, precioVenta: 50 },
    { productoId: "c", cantidadSistema: 3, costoUnitario: 10, precioVenta: 20 },
    { productoId: "d", cantidadSistema: 2, costoUnitario: 10, precioVenta: 20 },
  ];

  it("separa faltantes, sobrantes y productos sin contar", () => {
    const resumen = resumirToma(filas, { a: 8, b: 7, c: 3 });
    expect(resumen.contados).toBe(3);
    expect(resumen.sinContar).toBe(1);
    expect(resumen.conDiferencia).toBe(2);
    expect(resumen.faltanteUnidades).toBe(2);
    expect(resumen.sobranteUnidades).toBe(2);
    expect(resumen.faltanteCosto).toBe(200);
    expect(resumen.sobranteCosto).toBe(0); // sin costo vale 0
    expect(resumen.netoCosto).toBe(-200);
    expect(resumen.netoVenta).toBe(-2 * 150 + 2 * 50);
  });
});

describe("cruzarConteosImportados", () => {
  const productos = [
    { productoId: "a", codigo: "P-1" },
    { productoId: "b", codigo: "P-2" },
  ];

  it("cruza por código sin distinguir mayúsculas y reporta errores por fila", () => {
    const { conteos, errores } = cruzarConteosImportados(
      [
        { codigo: "p-1", contado: 4, fila: 2 },
        { codigo: "P-2", contado: "", fila: 3 },
        { codigo: "P-9", contado: 1, fila: 4 },
        { codigo: "P-2", contado: "x", fila: 5 },
      ],
      productos,
    );
    expect(conteos.get("a")).toBe(4);
    expect(conteos.has("b")).toBe(false);
    expect(errores.map((e) => e.fila)).toEqual([4, 5]);
  });
});

describe("validaciones del conteo", () => {
  it("acepta vacío y números con hasta 2 decimales", () => {
    expect(validatePhysicalCountField("contado", "")).toBe("");
    expect(validatePhysicalCountField("contado", "3,25")).toBe("");
  });

  it("rechaza texto, negativos y más de 2 decimales", () => {
    expect(validatePhysicalCountField("contado", "abc")).not.toBe("");
    expect(validatePhysicalCountField("contado", "-2")).not.toBe("");
    expect(validatePhysicalCountField("contado", "1.234")).not.toBe("");
  });

  it("valida el conjunto completo por producto", () => {
    expect(validatePhysicalCountEntries({ a: "1", b: "x" })).toEqual({ b: "Digita un número positivo." });
  });
});
