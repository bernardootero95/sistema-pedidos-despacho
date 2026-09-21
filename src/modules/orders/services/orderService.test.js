import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { orderService } from "./orderService";

vi.mock("../../../config/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("orderService.crearPedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a la RPC crear_pedido_transaccional con los parámetros mapeados correctamente", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "pedido-1" }, error: null });

    const cabecera = {
      cliente_id: "cliente-1",
      vendedor_id: "vendedor-1",
      notas: "Entregar en la mañana",
    };
    const detalles = [
      { producto_id: "prod-1", cantidad: "3" },
      { producto_id: "prod-2", cantidad: 5 },
    ];

    await orderService.crearPedido(cabecera, detalles);

    expect(supabase.rpc).toHaveBeenCalledWith("crear_pedido_transaccional", {
      p_cliente_id: "cliente-1",
      p_vendedor_id: "vendedor-1",
      p_notas: "Entregar en la mañana",
      p_detalles: [
        { producto_id: "prod-1", cantidad: 3, tipo_precio: "normal", tipo_precio_id: null },
        { producto_id: "prod-2", cantidad: 5, tipo_precio: "normal", tipo_precio_id: null },
      ],
    });
  });

  it("propaga el tipo_precio y tipo_precio_id de cada línea a la RPC", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.crearPedido({ cliente_id: "c1", vendedor_id: "v1" }, [
      { producto_id: "p1", cantidad: 20, tipo_precio: "mayorista" },
      { producto_id: "p2", cantidad: 1, tipo_precio: "personalizado", tipo_precio_id: "t-frio" },
    ]);

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_detalles[0].tipo_precio).toBe("mayorista");
    expect(params.p_detalles[0].tipo_precio_id).toBeNull();
    expect(params.p_detalles[1].tipo_precio).toBe("personalizado");
    expect(params.p_detalles[1].tipo_precio_id).toBe("t-frio");
  });

  it("convierte cantidad a Number aunque venga como string desde el formulario", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.crearPedido(
      { cliente_id: "c1", vendedor_id: "v1" },
      [{ producto_id: "p1", cantidad: "10" }],
    );

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_detalles[0].cantidad).toBe(10);
    expect(typeof params.p_detalles[0].cantidad).toBe("number");
  });

  it("envía null como p_notas cuando no se proporcionan notas", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.crearPedido(
      { cliente_id: "c1", vendedor_id: "v1" },
      [],
    );

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_notas).toBeNull();
  });

  it("devuelve la data de la RPC cuando la operación es exitosa", async () => {
    const pedidoCreado = { id: "pedido-1", numero_pedido: "PED-0001" };
    supabase.rpc.mockResolvedValue({ data: pedidoCreado, error: null });

    const resultado = await orderService.crearPedido(
      { cliente_id: "c1", vendedor_id: "v1" },
      [],
    );

    expect(resultado).toEqual(pedidoCreado);
  });

  it("envía los pagos a la RPC solo cuando se proporcionan (venta directa)", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    const pagos = [{ metodo_pago_id: "m1", monto: 9000 }];

    await orderService.crearPedido({ cliente_id: "c1", vendedor_id: "v1" }, [], pagos);
    expect(supabase.rpc.mock.calls[0][1].p_pagos).toEqual(pagos);

    await orderService.crearPedido({ cliente_id: "c1", vendedor_id: "v1" }, []);
    expect(supabase.rpc.mock.calls[1][1]).not.toHaveProperty("p_pagos");
  });

  it("propaga como Error el mensaje de la excepción de Postgres (RAISE EXCEPTION)", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Stock insuficiente para el producto XYZ" },
    });

    await expect(
      orderService.crearPedido({ cliente_id: "c1", vendedor_id: "v1" }, []),
    ).rejects.toThrow("Stock insuficiente para el producto XYZ");
  });

  it("usa un mensaje genérico si el error de Postgres no trae mensaje", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: {} });

    await expect(
      orderService.crearPedido({ cliente_id: "c1", vendedor_id: "v1" }, []),
    ).rejects.toThrow("Error al crear el pedido.");
  });
});

describe("orderService.editarPedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a la RPC editar_pedido_transaccional con los parámetros mapeados", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "pedido-1" }, error: null });

    const detalles = [
      { producto_id: "prod-1", cantidad: "4" },
      { producto_id: "prod-2", cantidad: 2 },
    ];

    await orderService.editarPedido("pedido-1", {
      notas: "Cambio de cantidad",
      detalles,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("editar_pedido_transaccional", {
      p_pedido_id: "pedido-1",
      p_notas: "Cambio de cantidad",
      p_detalles: [
        { producto_id: "prod-1", cantidad: 4, tipo_precio: "normal", tipo_precio_id: null },
        { producto_id: "prod-2", cantidad: 2, tipo_precio: "normal", tipo_precio_id: null },
      ],
    });
  });

  it("convierte cantidad a Number aunque venga como string desde el formulario", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.editarPedido("pedido-1", {
      detalles: [{ producto_id: "p1", cantidad: "7" }],
    });

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_detalles[0].cantidad).toBe(7);
    expect(typeof params.p_detalles[0].cantidad).toBe("number");
  });

  it("envía null como p_notas cuando no se proporcionan notas", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.editarPedido("pedido-1", { detalles: [] });

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_notas).toBeNull();
  });

  it("devuelve la data de la RPC cuando la edición es exitosa", async () => {
    const pedidoActualizado = { id: "pedido-1", total: 15000 };
    supabase.rpc.mockResolvedValue({ data: pedidoActualizado, error: null });

    const resultado = await orderService.editarPedido("pedido-1", {
      detalles: [],
    });

    expect(resultado).toEqual(pedidoActualizado);
  });

  it("propaga como Error el mensaje de la excepción de Postgres (ej. pedido ya no pendiente)", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Solo se pueden editar pedidos en estado pendiente (actual: despachado).",
      },
    });

    await expect(
      orderService.editarPedido("pedido-1", { detalles: [] }),
    ).rejects.toThrow(
      "Solo se pueden editar pedidos en estado pendiente (actual: despachado).",
    );
  });

  it("usa un mensaje genérico si el error de Postgres no trae mensaje", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: {} });

    await expect(
      orderService.editarPedido("pedido-1", { detalles: [] }),
    ).rejects.toThrow("Error al editar el pedido.");
  });

  it("marca el error como requiereConfirmacion (con el monto) cuando el servidor pide confirmar la devolución", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PD001",
        message: "El nuevo total es menor a lo ya abonado.",
        details: "5750",
      },
    });

    const error = await orderService
      .editarPedido("pedido-1", { detalles: [] })
      .catch((e) => e);

    expect(error.requiereConfirmacion).toBe(true);
    expect(error.montoDevolucion).toBe(5750);
  });

  it("no marca requiereConfirmacion en otros errores", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Stock insuficiente" },
    });

    const error = await orderService
      .editarPedido("pedido-1", { detalles: [] })
      .catch((e) => e);

    expect(error.requiereConfirmacion).toBeUndefined();
  });

  it("envía p_confirmar_devolucion solo cuando se confirma", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await orderService.editarPedido("pedido-1", { detalles: [], confirmarDevolucion: true });
    expect(supabase.rpc.mock.calls[0][1].p_confirmar_devolucion).toBe(true);

    await orderService.editarPedido("pedido-1", { detalles: [] });
    expect(supabase.rpc.mock.calls[1][1]).not.toHaveProperty("p_confirmar_devolucion");
  });
});
