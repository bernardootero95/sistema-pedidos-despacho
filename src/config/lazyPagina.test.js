import { describe, expect, it } from "vitest";
import { resolverCargaPagina } from "./lazyPagina";

const pendiente = Symbol("pendiente");
const esperar = (promesa) =>
  Promise.race([promesa, new Promise((resolver) => setTimeout(() => resolver(pendiente), 20))]);

describe("resolverCargaPagina", () => {
  it("entrega el módulo cuando el import resuelve normalmente", async () => {
    const modulo = { default: () => null };
    await expect(resolverCargaPagina(() => Promise.resolve(modulo))).resolves.toBe(modulo);
  });

  it("se queda pendiente si el import resuelve undefined (recarga por chunk desactualizado en curso)", async () => {
    await expect(esperar(resolverCargaPagina(() => Promise.resolve(undefined)))).resolves.toBe(pendiente);
  });

  it("propaga el rechazo cuando el import falla de verdad", async () => {
    const error = new Error("Failed to fetch dynamically imported module");
    await expect(resolverCargaPagina(() => Promise.reject(error))).rejects.toBe(error);
  });
});
