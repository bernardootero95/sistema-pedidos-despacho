import { describe, it, expect, vi } from "vitest";
import { obtenerTodasLasFilas, TAMANO_PAGINA } from "./obtenerTodasLasFilas";

// Simula una tabla de `total` filas detrás de un builder con .range().
const tablaDe = (total, error = null) => {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const range = vi.fn(async (desde, hasta) =>
    error ? { data: null, error } : { data: filas.slice(desde, hasta + 1), error: null },
  );
  return { construirQuery: vi.fn(() => ({ range })), range };
};

describe("obtenerTodasLasFilas", () => {
  it("trae todas las filas cuando superan el límite de una página", async () => {
    const { construirQuery, range } = tablaDe(TAMANO_PAGINA + 22);

    const { data, error } = await obtenerTodasLasFilas(construirQuery);

    expect(error).toBeNull();
    expect(data).toHaveLength(TAMANO_PAGINA + 22);
    expect(range).toHaveBeenNthCalledWith(1, 0, TAMANO_PAGINA - 1);
    expect(range).toHaveBeenNthCalledWith(2, TAMANO_PAGINA, 2 * TAMANO_PAGINA - 1);
    expect(construirQuery).toHaveBeenCalledTimes(2);
  });

  it("hace una sola consulta si cabe en una página", async () => {
    const { construirQuery } = tablaDe(5);

    const { data } = await obtenerTodasLasFilas(construirQuery);

    expect(data).toHaveLength(5);
    expect(construirQuery).toHaveBeenCalledTimes(1);
  });

  it("pide una página más si la última vino exactamente llena", async () => {
    const { construirQuery } = tablaDe(TAMANO_PAGINA);

    const { data } = await obtenerTodasLasFilas(construirQuery);

    expect(data).toHaveLength(TAMANO_PAGINA);
    expect(construirQuery).toHaveBeenCalledTimes(2);
  });

  it("propaga el error de la consulta", async () => {
    const { construirQuery } = tablaDe(0, { message: "boom" });

    const { data, error } = await obtenerTodasLasFilas(construirQuery);

    expect(data).toBeNull();
    expect(error).toEqual({ message: "boom" });
  });
});
