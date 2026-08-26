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

  it("actualizarCantidadInput acepta números y limita al stock disponible", () => {
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

  it("actualizarCantidadInput acepta decimales (media caja, etc.)", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.actualizarCantidadInput(0, "1.5"));
    expect(result.current.carrito[0].cantidad).toBe(1.5);
    expect(result.current.carrito[0].subtotal_linea).toBe(1500);

    // También acepta coma como separador decimal
    act(() => result.current.actualizarCantidadInput(0, "2,5"));
    expect(result.current.carrito[0].cantidad).toBe(2.5);
  });

  it("actualizarCantidadInput redondea al cuarto de unidad más cercano", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.actualizarCantidadInput(0, "1.3"));
    expect(result.current.carrito[0].cantidad).toBe(1.25);

    act(() => result.current.actualizarCantidadInput(0, "1.4"));
    expect(result.current.carrito[0].cantidad).toBe(1.5);
  });

  it("actualizarCantidadInput ignora un valor no numérico", () => {
    const { result } = renderHook(() => useCarritoPedido(productos));
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.actualizarCantidadInput(0, "abc"));
    expect(result.current.carrito[0].cantidad).toBe(1);
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

describe("useCarritoPedido: precio al por mayor automático por cantidad", () => {
  const productoConMayorista = {
    id: "p3",
    nombre: "Producto Mayorista",
    codigo: "P003",
    precio_venta: 1000,
    iva: 19,
    inc: 0,
    disponible: 100,
    precio_frio: null,
    tiersMayoristas: [
      { producto_id: "p3", cantidad_minima: 10, precio: 900 },
      { producto_id: "p3", cantidad_minima: 50, precio: 800 },
    ],
  };

  it("no aplica mayorista si la cantidad no alcanza ninguna franja", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConMayorista]),
    );
    act(() => result.current.agregarAlCarrito("p3"));

    expect(result.current.carrito[0].tipo_precio).toBe("normal");
    expect(result.current.carrito[0].precio_unitario).toBe(1000);
  });

  it("aplica la franja automáticamente al alcanzar la cantidad mínima, sin activarla a mano", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConMayorista]),
    );
    act(() => result.current.agregarAlCarrito("p3"));

    act(() => result.current.actualizarCantidadInput(0, "10"));
    expect(result.current.carrito[0].tipo_precio).toBe("mayorista");
    expect(result.current.carrito[0].precio_unitario).toBe(900);
    expect(result.current.carrito[0].subtotal_linea).toBe(9000);
  });

  it("sube a la siguiente franja (más barata) al seguir subiendo la cantidad", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConMayorista]),
    );
    act(() => result.current.agregarAlCarrito("p3"));
    act(() => result.current.actualizarCantidadInput(0, "10"));

    act(() => result.current.actualizarCantidadInput(0, "50"));
    expect(result.current.carrito[0].tipo_precio).toBe("mayorista");
    expect(result.current.carrito[0].precio_unitario).toBe(800);
  });

  it("si ya estaba en mayorista y la cantidad baja del umbral, se mantiene forzado en la franja de entrada", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConMayorista]),
    );
    act(() => result.current.agregarAlCarrito("p3"));
    act(() => result.current.actualizarCantidadInput(0, "10")); // franja 10 -> 900

    act(() => result.current.actualizarCantidadInput(0, "5")); // ya no califica para ninguna
    expect(result.current.carrito[0].tipo_precio).toBe("mayorista");
    expect(result.current.carrito[0].precio_unitario).toBe(900); // franja de entrada (menor cantidad_minima)
  });

  it("cambiarTipoPrecio fuerza mayorista aunque la cantidad no alcance ninguna franja (usa la de entrada, no la más profunda)", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConMayorista]),
    );
    act(() => result.current.agregarAlCarrito("p3")); // cantidad 1, normal

    act(() => result.current.cambiarTipoPrecio(0, "mayorista"));
    expect(result.current.carrito[0].tipo_precio).toBe("mayorista");
    expect(result.current.carrito[0].precio_unitario).toBe(900);
  });

  it("un producto sin franjas configuradas nunca activa mayorista aunque suba la cantidad", () => {
    const { result } = renderHook(() => useCarritoPedido(productos)); // p1 sin tiersMayoristas
    act(() => result.current.agregarAlCarrito("p1"));

    act(() => result.current.actualizarCantidadInput(0, "3"));
    expect(result.current.carrito[0].tipo_precio).toBe("normal");
    expect(result.current.carrito[0].precio_unitario).toBe(1000);
  });
});

describe("useCarritoPedido: precio a crédito (manual, no depende de la cantidad)", () => {
  const productoConCredito = {
    id: "p4",
    nombre: "Producto Crédito",
    codigo: "P004",
    precio_venta: 1000,
    iva: 19,
    inc: 0,
    disponible: 100,
    precio_frio: null,
    precio_credito: 1300,
    tiersMayoristas: [],
  };

  it("no se activa solo, hay que forzarlo con cambiarTipoPrecio", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConCredito]),
    );
    act(() => result.current.agregarAlCarrito("p4"));
    act(() => result.current.actualizarCantidadInput(0, "20"));

    expect(result.current.carrito[0].tipo_precio).toBe("normal");
    expect(result.current.carrito[0].precio_unitario).toBe(1000);
  });

  it("cambiarTipoPrecio aplica el precio a crédito configurado", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConCredito]),
    );
    act(() => result.current.agregarAlCarrito("p4"));

    act(() => result.current.cambiarTipoPrecio(0, "credito"));
    expect(result.current.carrito[0].tipo_precio).toBe("credito");
    expect(result.current.carrito[0].precio_unitario).toBe(1300);
  });

  it("una vez en crédito, el precio no cambia al modificar la cantidad", () => {
    const { result } = renderHook(() =>
      useCarritoPedido([productoConCredito]),
    );
    act(() => result.current.agregarAlCarrito("p4"));
    act(() => result.current.cambiarTipoPrecio(0, "credito"));

    act(() => result.current.modificarCantidad(0, 1));
    expect(result.current.carrito[0].tipo_precio).toBe("credito");
    expect(result.current.carrito[0].precio_unitario).toBe(1300);
    expect(result.current.carrito[0].subtotal_linea).toBe(2600); // 2 * 1300
  });
});
