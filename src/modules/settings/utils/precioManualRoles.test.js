import { describe, expect, it } from "vitest";
import { alternarRol, validatePrecioManualRoles } from "./precioManualRoles";

describe("validatePrecioManualRoles", () => {
  it("exige al menos un perfil", () => {
    expect(validatePrecioManualRoles([])).not.toBe("");
    expect(validatePrecioManualRoles(undefined)).not.toBe("");
  });

  it("acepta perfiles del catálogo y rechaza los que no lo son", () => {
    expect(validatePrecioManualRoles(["soporte", "gerencia"])).toBe("");
    expect(validatePrecioManualRoles(["repartidor"])).not.toBe("");
  });
});

describe("alternarRol", () => {
  it("agrega un perfil respetando el orden del catálogo", () => {
    expect(alternarRol(["gerencia"], "soporte")).toEqual(["soporte", "gerencia"]);
    expect(alternarRol(["soporte"], "cajera")).toEqual(["soporte", "cajera"]);
  });

  it("quita un perfil que ya estaba", () => {
    expect(alternarRol(["soporte", "gerencia"], "soporte")).toEqual(["gerencia"]);
  });
});
