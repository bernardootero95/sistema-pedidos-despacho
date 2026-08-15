import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePaginatedList } from "./usePaginatedList";

const paginaVacia = { data: [], total: 0, totalPages: 1 };

describe("usePaginatedList", () => {
  it("carga la primera página al montar, con el término de búsqueda vacío", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [{ id: 1 }],
      total: 1,
      totalPages: 1,
    });

    const { result } = renderHook(() => usePaginatedList(fetchPage));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchPage).toHaveBeenCalledWith(1, 10, "");
    expect(result.current.items).toEqual([{ id: 1 }]);
    expect(result.current.totalItems).toBe(1);
  });

  it("respeta el pageSize configurado por opciones", async () => {
    const fetchPage = vi.fn().mockResolvedValue(paginaVacia);

    renderHook(() => usePaginatedList(fetchPage, { pageSize: 25 }));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith(1, 25, ""));
  });

  it("hace debounce de la búsqueda y resetea a la página 1 en un solo fetch (no dos)", async () => {
    const fetchPage = vi.fn().mockResolvedValue(paginaVacia);
    const { result } = renderHook(() =>
      usePaginatedList(fetchPage, { debounceMs: 20 }),
    );

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.setSearchTerm("acme");
    });

    // Antes de que venza el debounce no debe dispararse un tercer fetch.
    expect(fetchPage).toHaveBeenCalledTimes(2);

    // Si el debounce y el reseteo de página estuvieran en efectos separados,
    // aquí se verían 2 llamadas más (una con la página vieja, otra con la
    // reseteada) en vez de 1 sola. Es justo el bug que este hook evita.
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage).toHaveBeenLastCalledWith(1, 10, "acme");
    expect(result.current.currentPage).toBe(1);
  });

  it("expone el mensaje de error del fetch sin tocar los items previos", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error("Fallo de red"));
    const { result } = renderHook(() => usePaginatedList(fetchPage));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Fallo de red");
    expect(result.current.items).toEqual([]);
  });

  it("limpia el error en la siguiente carga exitosa vía reload()", async () => {
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fallo de red"))
      .mockResolvedValueOnce({ data: [{ id: 1 }], total: 1, totalPages: 1 });

    const { result } = renderHook(() => usePaginatedList(fetchPage));

    await waitFor(() => expect(result.current.error).toBe("Fallo de red"));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe("");
    expect(result.current.items).toEqual([{ id: 1 }]);
  });

  it("permite mutar items localmente vía setItems (actualización optimista)", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: [{ id: 1, estado: true }],
      total: 1,
      totalPages: 1,
    });
    const { result } = renderHook(() => usePaginatedList(fetchPage));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setItems((prev) =>
        prev.map((item) =>
          item.id === 1 ? { ...item, estado: false } : item,
        ),
      );
    });

    expect(result.current.items).toEqual([{ id: 1, estado: false }]);
  });
});
