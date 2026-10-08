import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClientPagination } from "./useClientPagination";

const items = Array.from({ length: 120 }, (_, i) => i + 1);

describe("useClientPagination", () => {
  it("devuelve solo la página actual y el total de páginas", () => {
    const { result } = renderHook(() => useClientPagination(items, { pageSize: 50 }));
    expect(result.current.pageItems).toHaveLength(50);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(120);

    act(() => result.current.setCurrentPage(3));
    expect(result.current.pageItems).toEqual(items.slice(100));
  });

  it("vuelve a la página 1 cuando cambia la clave del filtro", () => {
    const { result, rerender } = renderHook(({ clave }) => useClientPagination(items, { pageSize: 50, resetKey: clave }), {
      initialProps: { clave: "a" },
    });
    act(() => result.current.setCurrentPage(2));
    expect(result.current.currentPage).toBe(2);

    rerender({ clave: "b" });
    expect(result.current.currentPage).toBe(1);
  });

  it("acota la página si la lista se acorta", () => {
    const { result, rerender } = renderHook(({ lista }) => useClientPagination(lista, { pageSize: 50 }), {
      initialProps: { lista: items },
    });
    act(() => result.current.setCurrentPage(3));
    rerender({ lista: items.slice(0, 60) });
    expect(result.current.currentPage).toBe(2);
  });

  it("cambiar el tamaño de página reinicia a la primera", () => {
    const { result } = renderHook(() => useClientPagination(items, { pageSize: 50 }));
    act(() => result.current.setCurrentPage(2));
    act(() => result.current.setPageSize(100));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(2);
  });
});
