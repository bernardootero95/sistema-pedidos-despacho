import { describe, it, expect, vi } from "vitest";
import { recargarPorChunkDesactualizado } from "./chunkReload";

const crearAlmacen = (inicial = {}) => {
  const datos = { ...inicial };
  return {
    getItem: (k) => datos[k] ?? null,
    setItem: (k, v) => {
      datos[k] = v;
    },
  };
};

describe("recargarPorChunkDesactualizado", () => {
  it("recarga la primera vez y deja la marca", () => {
    const recargar = vi.fn();
    const almacen = crearAlmacen();

    const resultado = recargarPorChunkDesactualizado({
      almacen,
      recargar,
      ahora: 100_000,
    });

    expect(resultado).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(almacen.getItem("chunk-reload-ultimo-intento")).toBe("100000");
  });

  it("no vuelve a recargar dentro de la ventana anti-bucle", () => {
    const recargar = vi.fn();
    const almacen = crearAlmacen({ "chunk-reload-ultimo-intento": "100000" });

    const resultado = recargarPorChunkDesactualizado({
      almacen,
      recargar,
      ahora: 105_000,
    });

    expect(resultado).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });

  it("recarga de nuevo pasada la ventana", () => {
    const recargar = vi.fn();
    const almacen = crearAlmacen({ "chunk-reload-ultimo-intento": "100000" });

    const resultado = recargarPorChunkDesactualizado({
      almacen,
      recargar,
      ahora: 120_000,
    });

    expect(resultado).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("no recarga si sessionStorage no está disponible", () => {
    const recargar = vi.fn();
    const almacen = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {},
    };

    const resultado = recargarPorChunkDesactualizado({ almacen, recargar });

    expect(resultado).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });
});
