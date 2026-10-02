import { describe, it, expect } from "vitest";
import {
  validateCompanyField,
  validateCompanyForm,
  validateLogo,
} from "./companyValidations";

describe("validateCompanyForm", () => {
  it("exige la razón social y acepta el resto vacío", () => {
    expect(validateCompanyForm({ razon_social: "" })).toEqual({
      razon_social: "La razón social es obligatoria.",
    });
    expect(validateCompanyForm({ razon_social: "Empresa S.A.S." })).toEqual({});
  });

  it("valida NIT, dígito de verificación y correo", () => {
    expect(validateCompanyField("nit", "900.123.456")).not.toBe("");
    expect(validateCompanyField("nit", "900123456")).toBe("");
    expect(validateCompanyField("digito_verificacion", "7", { nit: "" })).toBe(
      "Ingresa primero el NIT.",
    );
    expect(validateCompanyField("digito_verificacion", "12", { nit: "1" })).toBe(
      "Un solo dígito.",
    );
    expect(validateCompanyField("correo", "no-es-correo")).toBe("Correo inválido.");
  });
});

describe("validateLogo", () => {
  it("acepta PNG/JPG/WEBP de hasta 1 MB", () => {
    expect(validateLogo({ type: "image/png", size: 1000 })).toBe("");
    expect(validateLogo({ type: "image/gif", size: 1000 })).not.toBe("");
    expect(validateLogo({ type: "image/png", size: 2 * 1024 * 1024 })).not.toBe("");
  });
});
