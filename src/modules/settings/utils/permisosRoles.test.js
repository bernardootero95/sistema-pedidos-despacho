import { describe, expect, it } from "vitest";
import {
  ROLES_CREDITO,
  ROLES_PRECIO_MANUAL,
  alternarRol,
  validatePermisoRoles,
} from "./permisosRoles";

describe("validatePermisoRoles", () => {
  it("exige soporte y gerencia", () => {
    expect(validatePermisoRoles(["vendedor"], ROLES_PRECIO_MANUAL)).not.toBe("");
    expect(validatePermisoRoles(["soporte"], ROLES_PRECIO_MANUAL)).not.toBe("");
    expect(validatePermisoRoles(undefined, ROLES_PRECIO_MANUAL)).not.toBe("");
  });

  it("acepta perfiles del catálogo y rechaza los que no lo son", () => {
    expect(validatePermisoRoles(["soporte", "gerencia", "cajera"], ROLES_PRECIO_MANUAL)).toBe("");
    expect(
      validatePermisoRoles(["soporte", "gerencia", "repartidor"], ROLES_PRECIO_MANUAL),
    ).not.toBe("");
    expect(validatePermisoRoles(["soporte", "gerencia", "repartidor"], ROLES_CREDITO)).toBe("");
  });
});

describe("alternarRol", () => {
  it("agrega un perfil respetando el orden del catálogo", () => {
    expect(alternarRol(["soporte", "gerencia", "cajera"], "vendedor", ROLES_PRECIO_MANUAL)).toEqual([
      "soporte",
      "gerencia",
      "vendedor",
      "cajera",
    ]);
  });

  it("quita un perfil que ya estaba", () => {
    expect(alternarRol(["soporte", "gerencia", "cajera"], "cajera", ROLES_PRECIO_MANUAL)).toEqual([
      "soporte",
      "gerencia",
    ]);
  });

  it("nunca quita soporte ni gerencia", () => {
    expect(alternarRol(["soporte", "gerencia"], "soporte", ROLES_PRECIO_MANUAL)).toEqual([
      "soporte",
      "gerencia",
    ]);
  });
});
