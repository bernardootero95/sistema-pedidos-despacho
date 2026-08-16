import { describe, it, expect } from "vitest";
import {
  validatePasswordField,
  validatePasswordForm,
} from "./passwordValidations";

describe("validatePasswordField", () => {
  it("exige la contraseña", () => {
    expect(validatePasswordField("password", "", {})).toBe(
      "La contraseña es obligatoria.",
    );
  });

  it("exige un mínimo de 6 caracteres", () => {
    expect(validatePasswordField("password", "abc12", {})).toBe(
      "Debe tener al menos 6 caracteres.",
    );
    expect(validatePasswordField("password", "abc123", {})).toBe("");
  });

  it("exige confirmar la contraseña", () => {
    expect(validatePasswordField("confirmPassword", "", {})).toBe(
      "Confirma la contraseña.",
    );
  });

  it("valida que confirmPassword coincida con password", () => {
    expect(
      validatePasswordField("confirmPassword", "abc123", {
        password: "abc124",
      }),
    ).toBe("Las contraseñas no coinciden.");
    expect(
      validatePasswordField("confirmPassword", "abc123", {
        password: "abc123",
      }),
    ).toBe("");
  });

  it("retorna cadena vacía para campos sin validador registrado", () => {
    expect(validatePasswordField("otroCampo", "x", {})).toBe("");
  });
});

describe("validatePasswordForm", () => {
  it("no reporta errores cuando password y confirmPassword son válidos e iguales", () => {
    expect(
      validatePasswordForm({ password: "abc123", confirmPassword: "abc123" }),
    ).toEqual({});
  });

  it("reporta ambos campos cuando están vacíos", () => {
    const errores = validatePasswordForm({
      password: "",
      confirmPassword: "",
    });
    expect(errores.password).toBe("La contraseña es obligatoria.");
    expect(errores.confirmPassword).toBe("Confirma la contraseña.");
  });

  it("reporta solo confirmPassword cuando no coincide", () => {
    const errores = validatePasswordForm({
      password: "abc123",
      confirmPassword: "xyz789",
    });
    expect(errores.password).toBeUndefined();
    expect(errores.confirmPassword).toBe("Las contraseñas no coinciden.");
  });
});
