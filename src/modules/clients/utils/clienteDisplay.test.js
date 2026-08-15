import { describe, it, expect } from "vitest";
import { getNombreCliente } from "./clienteDisplay";

describe("getNombreCliente", () => {
  it("prioriza razon_social cuando el cliente es persona jurídica", () => {
    expect(
      getNombreCliente({
        razon_social: "Distribuidora ACME S.A.S.",
        primer_nombre: "Ana",
        primer_apellido: "Gómez",
      }),
    ).toBe("Distribuidora ACME S.A.S.");
  });

  it("arma nombre + apellido cuando no hay razon_social (persona natural)", () => {
    expect(
      getNombreCliente({
        razon_social: "",
        primer_nombre: "Ana",
        primer_apellido: "Gómez",
      }),
    ).toBe("Ana Gómez");
  });

  it("no deja espacios colgantes si falta el apellido o el nombre", () => {
    expect(
      getNombreCliente({ razon_social: "", primer_nombre: "Ana" }),
    ).toBe("Ana");
    expect(
      getNombreCliente({ razon_social: "", primer_apellido: "Gómez" }),
    ).toBe("Gómez");
  });

  it("retorna cadena vacía si el cliente es null o undefined", () => {
    expect(getNombreCliente(null)).toBe("");
    expect(getNombreCliente(undefined)).toBe("");
  });

  it("retorna cadena vacía si no hay ningún dato de nombre disponible", () => {
    expect(getNombreCliente({})).toBe("");
  });
});
