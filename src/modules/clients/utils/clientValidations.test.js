import { describe, it, expect } from "vitest";
import {
  validateClientField,
  validateClientForm,
} from "./clientValidations";

describe("validateClientField", () => {
  it("exige número de identificación", () => {
    expect(validateClientField("numero_identificacion", "", {})).toBe(
      "El número de identificación es obligatorio.",
    );
    expect(validateClientField("numero_identificacion", "  ", {})).toBe(
      "El número de identificación es obligatorio.",
    );
    expect(validateClientField("numero_identificacion", "900123456", {})).toBe(
      "",
    );
  });

  it("valida el formato de correo solo cuando hay un valor", () => {
    expect(validateClientField("correo", "", {})).toBe("");
    expect(validateClientField("correo", "no-es-un-correo", {})).toBe(
      "Formato de correo inválido.",
    );
    expect(validateClientField("correo", "cliente@empresa.com", {})).toBe("");
  });

  it("exige primer_nombre y primer_apellido solo para persona natural", () => {
    const natural = { tipo_organizacion: "natural" };
    const juridica = { tipo_organizacion: "juridica" };

    expect(validateClientField("primer_nombre", "", natural)).toBe(
      "El primer nombre es obligatorio.",
    );
    expect(validateClientField("primer_apellido", "", natural)).toBe(
      "El primer apellido es obligatorio.",
    );
    // Persona jurídica no debe exigir nombre/apellido.
    expect(validateClientField("primer_nombre", "", juridica)).toBe("");
    expect(validateClientField("primer_apellido", "", juridica)).toBe("");
  });

  it("exige razon_social solo para persona jurídica", () => {
    const natural = { tipo_organizacion: "natural" };
    const juridica = { tipo_organizacion: "juridica" };

    expect(validateClientField("razon_social", "", juridica)).toBe(
      "La razón social es obligatoria.",
    );
    // Persona natural no debe exigir razón social.
    expect(validateClientField("razon_social", "", natural)).toBe("");
  });

  it("retorna cadena vacía para campos sin validador registrado", () => {
    expect(validateClientField("campo_inexistente", "", {})).toBe("");
  });
});

describe("validateClientForm", () => {
  it("no reporta errores para un formulario de persona natural completo", () => {
    const formData = {
      numero_identificacion: "1020304050",
      tipo_identificacion: "CC",
      tipo_organizacion: "natural",
      direccion: "Calle 1 # 2-3",
      ciudad_municipio: "Bogotá",
      correo: "cliente@empresa.com",
      primer_nombre: "Ana",
      primer_apellido: "Gómez",
      razon_social: "",
    };
    expect(validateClientForm(formData)).toEqual({});
  });

  it("reporta solo los campos condicionales faltantes según tipo_organizacion", () => {
    const formData = {
      numero_identificacion: "900123456",
      tipo_identificacion: "NIT",
      tipo_organizacion: "juridica",
      direccion: "Calle 1 # 2-3",
      ciudad_municipio: "Bogotá",
      correo: "",
      primer_nombre: "",
      primer_apellido: "",
      razon_social: "",
    };
    const errores = validateClientForm(formData);

    expect(errores.razon_social).toBe("La razón social es obligatoria.");
    // Persona jurídica: nombre/apellido no deberían reportarse como error.
    expect(errores.primer_nombre).toBeUndefined();
    expect(errores.primer_apellido).toBeUndefined();
  });
});
