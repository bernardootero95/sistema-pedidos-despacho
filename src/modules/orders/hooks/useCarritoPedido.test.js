import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCarritoPedido } from "./useCarritoPedido";

const productos = [
  { id: "p1", nombre: "Producto 1", codigo: "P001", precio_venta: 1000, iva: 19, inc: 0, disponible: 3 },
  { id: "p2", nombre: "Producto 2", codigo: "P002", precio_venta: 2000, iva: 0, inc: 8, disponible: 0 },
];

describe("useCarritoPedido", () => {
  it("empieza vacío por defecto", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    expect(result.current.carrito).toEqual([]);
    expect(result.current.totalPedido).toBe(0);
  });

  it("acepta un carrito inicial (modo edición)", () => {
    const itemsIniciales = [
      {
        producto_id: "p1",
        nombre: "Producto 1",
        codigo: "P001",
        cantidad: 2,
        precio_unitario: 1000,
        iva_porcentaje: 19,
        inc_porcentaje: 0,
        subtotal_linea: 2000,
        disponible: 5,
      },
    ];
    const { result } = renderHook(() =>
      useCarritoPedido(productos, itemsIniciales),
    );

    expect(result.current.carrito).toEqual(itemsIniciales);
    expect(result.current.totalPedido).toBe(2000);
  });

  it("agrega un producto nuevo al carrito con cantidad 1", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    act(() => {
      result.current.agregarAlCarrito("p1");
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0]).toMatchObject({
      producto_id: "p1",
      cantidad: 1,
      precio_unitario: 1000,
      subtotal_linea: 1000,
    });
    expect(result.current.totalPedido).toBe(1000);
  });

  it("incrementa en 1 si el producto ya está en el carrito", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    act(() => {
      result.current.agregarAlCarrito("p1");
    });
    act(() => {
      result.current.agregarAlCarrito("p1");
    });

    expect(result.current.carrito).toHaveLength(1);
    expect(result.current.carrito[0].cantidad).toBe(2);
    expect(result.current.carrito[0].subtotal_linea).toBe(2000);
  });

  it("no agrega un producto sin stock y reporta errorStock", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    act(() => {
      result.current.agregarAlCarrito("p2"); // disponible: 0
    });

    expect(result.current.carrito).toHaveLength(0);
    expect(result.current.errorStock).toMatch(/no tiene existencias/i);
  });

  it("no agrega más unidades de las disponibles al incrementar", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    act(() => {
      result.current.agregarAlCarrito("p1"); // 1
    });
    act(() => {
      result.current.agregarAlCarrito("p1"); // 2
    });
    act(() => {
      result.current.agregarAlCarrito("p1"); // 3 (== disponible, ok)
    });
    act(() => {
      result.current.agregarAlCarrito("p1"); // 4 > disponible: rechazado
    });

    expect(result.current.carrito[0].cantidad).toBe(3);
    expect(result.current.errorStock).toMatch(/no puedes agregar más/i);
  });

  it("modificarCantidad incrementa/decrementa respetando el stock", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.modificarCantidad(0, 1));
    expect(result.current.carrito[0].cantidad).toBe(2);

    act(() => result.current.modificarCantidad(0, 1));
    expect(result.current.carrito[0].cantidad).toBe(3);

    // disponible es 3: un incremento más debe rechazarse
    act(() => result.current.modificarCantidad(0, 1));
    expect(result.current.carrito[0].cantidad).toBe(3);
    expect(result.current.errorStock).toMatch(/stock máximo/i);
  });

  it("modificarCantidad elimina la línea si la cantidad baja a 0", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.modificarCantidad(0, -1));

    expect(result.current.carrito).toHaveLength(0);
  });

  it("actualizarCantidadInput acepta solo dígitos y limita al stock disponible", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.actualizarCantidadInput(0, "2"));
    expect(result.current.carrito[0].cantidad).toBe(2);
    expect(result.current.carrito[0].subtotal_linea).toBe(2000);

    // Por encima del disponible (3): se limita y se reporta el error
    act(() => result.current.actualizarCantidadInput(0, "10"));
    expect(result.current.carrito[0].cantidad).toBe(3);
    expect(result.current.errorStock).toMatch(/stock máximo/i);
  });

  it("eliminarDelCarrito quita la línea indicada", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.eliminarDelCarrito(0));

    expect(result.current.carrito).toHaveLength(0);
  });

  it("totalPedido suma el subtotal de todas las líneas", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));

    act(() => result.current.agregarAlCarrito("p1"));
    act(() => result.current.modificarCantidad(0, 1)); // 2 * 1000 = 2000

    expect(result.current.totalPedido).toBe(2000);
  });
});
