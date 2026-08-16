import { describe, it, expect } from "vitest";
import { validateUserField, validateUserForm } from "./userValidations";

describe("validateUserField", () => {
  it("exige nombre_completo", () => {
    expect(validateUserField("nombre_completo", "")).toBe(
      "El nombre completo es obligatorio.",
    );
    expect(validateUserField("nombre_completo", "María Gómez")).toBe("");
  });

  it("valida nombre_usuario: obligatorio, sin espacios, sin @", () => {
    expect(validateUserField("nombre_usuario", "")).toBe(
      "El nombre de usuario es obligatorio.",
    );
    expect(validateUserField("nombre_usuario", "maria gomez")).toBe(
      "No debe contener espacios.",
    );
    expect(validateUserField("nombre_usuario", "maria@empresa.com")).toBe(
      "Ingresa solo el usuario, sin el dominio.",
    );
    expect(validateUserField("nombre_usuario", "maria.gomez")).toBe("");
  });

  it("delega la validación de password en la regla compartida (mínimo 6)", () => {
    expect(validateUserField("password", "abc12")).toBe(
      "Debe tener al menos 6 caracteres.",
    );
    expect(validateUserField("password", "abc123")).toBe("");
  });

  it("exige rol_id", () => {
    expect(validateUserField("rol_id", "")).toBe(
      "Debes asignar un rol al usuario.",
    );
    expect(validateUserField("rol_id", "3")).toBe("");
  });

  it("correo es opcional pero valida el formato si se completa", () => {
    expect(validateUserField("correo", "")).toBe("");
    expect(validateUserField("correo", "no-es-un-correo")).toBe(
      "Formato de correo inválido.",
    );
    expect(validateUserField("correo", "maria@gmail.com")).toBe("");
  });
});

describe("validateUserForm", () => {
  const formularioValido = {
    nombre_completo: "María Gómez",
    nombre_usuario: "maria.gomez",
    password: "abc123",
    rol_id: "3",
    correo: "",
  };

  it("no reporta errores para un alta válida sin correo", () => {
    expect(validateUserForm(formularioValido)).toEqual({});
  });

  it("valida los 5 campos en modo alta (no editMode)", () => {
    const errores = validateUserForm({
      nombre_completo: "",
      nombre_usuario: "",
      password: "",
      rol_id: "",
      correo: "mal-formado",
    });
    expect(Object.keys(errores).sort()).toEqual(
      ["correo", "nombre_completo", "nombre_usuario", "password", "rol_id"].sort(),
    );
  });

  it("en modo edición solo valida correo, ignorando los demás campos vacíos", () => {
    const errores = validateUserForm(
      {
        nombre_completo: "",
        nombre_usuario: "",
        password: "",
        rol_id: "",
        correo: "no-valido",
      },
      { editMode: true },
    );
    expect(errores).toEqual({ correo: "Formato de correo inválido." });
  });
});
