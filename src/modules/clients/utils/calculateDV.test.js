import { describe, it, expect } from "vitest";
import { calculateDV } from "./calculateDV";

describe("calculateDV", () => {
  it("calcula el DV para un NIT de 9 dígitos (caso típico)", () => {
    // "900123456": suma ponderada = 9*41+0*37+0*29+1*23+2*19+3*17+4*13+5*7+6*3
    // = 586; 586 % 11 = 3; como 3 > 1, DV = 11 - 3 = 8.
    expect(calculateDV("900123456")).toBe("8");
  });

  it("no resta de 11 cuando el residuo del módulo 11 es exactamente 1", () => {
    // "4": único dígito, peso vpri[0]=3 -> x=12, 12 % 11 = 1 -> DV = "1"
    // (rama y2 > 1 nunca se ejecuta aquí; protege contra invertir la condición)
    expect(calculateDV("4")).toBe("1");
  });

  it("no resta de 11 cuando el residuo del módulo 11 es exactamente 0", () => {
    // "15": pesos vpri[1]=7 y vpri[0]=3 -> x=1*7+5*3=22, 22 % 11 = 0 -> DV = "0"
    expect(calculateDV("15")).toBe("0");
  });

  it("resta de 11 cuando el residuo es mayor a 1", () => {
    // "12": pesos vpri[1]=7 y vpri[0]=3 -> x=1*7+2*3=13, 13 % 11 = 2 -> DV = 11-2 = 9
    expect(calculateDV("12")).toBe("9");
  });

  it("retorna cadena vacía para valores no numéricos", () => {
    expect(calculateDV("abc")).toBe("");
    expect(calculateDV("123abc")).toBe("");
  });

  it("retorna cadena vacía para valores vacíos, nulos o indefinidos", () => {
    expect(calculateDV("")).toBe("");
    expect(calculateDV(null)).toBe("");
    expect(calculateDV(undefined)).toBe("");
  });
});
