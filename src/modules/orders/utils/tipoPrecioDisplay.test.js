import { describe, it, expect } from "vitest";
import { etiquetaTipoPrecio } from "./tipoPrecioDisplay";

describe("etiquetaTipoPrecio", () => {
  it("no destaca el precio normal", () => {
    expect(etiquetaTipoPrecio({ tipo_precio: "normal" })).toBe("");
    expect(etiquetaTipoPrecio(undefined)).toBe("");
  });

  it("identifica el mayorista", () => {
    expect(etiquetaTipoPrecio({ tipo_precio: "mayorista" })).toBe("Mayorista");
  });

  it("usa el nombre del tipo del catálogo para los personalizados", () => {
    expect(
      etiquetaTipoPrecio({
        tipo_precio: "personalizado",
        tipo: { nombre: "Distribuidor" },
      }),
    ).toBe("Distribuidor");
  });

  it("cae a un genérico si el personalizado no trae su nombre", () => {
    expect(etiquetaTipoPrecio({ tipo_precio: "personalizado" })).toBe(
      "Precio especial",
    );
  });
});
