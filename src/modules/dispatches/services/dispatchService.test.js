import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { dispatchService } from "./dispatchService";

vi.mock("../../../config/supabase", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

describe("dispatchService.crearDespachoTransaccional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a la RPC crear_despacho_transaccional con los parámetros mapeados", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "despacho-1" }, error: null });

    const cabecera = {
      vehiculo_id: "vehiculo-1",
      repartidor_id: "repartidor-1",
      fecha_despacho: "2026-08-15T10:00:00Z",
      notas: "Ruta norte",
    };
    const pedidosIds = ["pedido-1", "pedido-2"];

    await dispatchService.crearDespachoTransaccional(cabecera, pedidosIds);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "crear_despacho_transaccional",
      {
        p_vehiculo_id: "vehiculo-1",
        p_repartidor_id: "repartidor-1",
        p_fecha_despacho: "2026-08-15T10:00:00Z",
        p_notas: "Ruta norte",
        p_pedidos_ids: pedidosIds,
      },
    );
  });

  it("envía null como p_notas cuando no se proporcionan notas", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await dispatchService.crearDespachoTransaccional(
      { vehiculo_id: "v1", repartidor_id: "r1", fecha_despacho: "2026-01-01" },
      ["p1"],
    );

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_notas).toBeNull();
  });

  it("propaga el error cuando el vehículo ya tiene un despacho activo", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "El vehículo ya tiene un despacho activo." },
    });

    await expect(
      dispatchService.crearDespachoTransaccional(
        { vehiculo_id: "v1", repartidor_id: "r1", fecha_despacho: "2026-01-01" },
        ["p1"],
      ),
    ).rejects.toThrow("El vehículo ya tiene un despacho activo.");
  });
});

describe("dispatchService.actualizarEstadoDespachoTransaccional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a la RPC con el id del despacho y el nuevo estado", async () => {
    supabase.rpc.mockResolvedValue({ data: { estado: "en_ruta" }, error: null });

    await dispatchService.actualizarEstadoDespachoTransaccional(
      "despacho-1",
      "en_ruta",
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "actualizar_estado_despacho_transaccional",
      { p_despacho_id: "despacho-1", p_nuevo_estado: "en_ruta" },
    );
  });

  it("propaga el error cuando la transición de estado no es válida", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Transición de estado no permitida." },
    });

    await expect(
      dispatchService.actualizarEstadoDespachoTransaccional(
        "despacho-1",
        "completado",
      ),
    ).rejects.toThrow("Transición de estado no permitida.");
  });
});

describe("dispatchService.actualizarEstadoEntregaPedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a la RPC con despachoPedidoId, nuevo estado y notas", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await dispatchService.actualizarEstadoEntregaPedido(
      "dp-1",
      "rechazado",
      "Cliente ausente",
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "actualizar_estado_entrega_pedido_transaccional",
      {
        p_despacho_pedido_id: "dp-1",
        p_nuevo_estado_entrega: "rechazado",
        p_notas_entrega: "Cliente ausente",
      },
    );
  });

  it("usa null como notas por defecto", async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });

    await dispatchService.actualizarEstadoEntregaPedido("dp-1", "entregado");

    const [, params] = supabase.rpc.mock.calls[0];
    expect(params.p_notas_entrega).toBeNull();
  });
});

describe("dispatchService.obtenerRutaActivaRepartidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildDespachoQuery = (result) => {
    const builder = {};
    ["select", "eq", "in", "is", "order", "limit"].forEach((method) => {
      builder[method] = vi.fn().mockReturnValue(builder);
    });
    builder.maybeSingle = vi.fn().mockResolvedValue(result);
    return builder;
  };

  const buildDetallesQuery = (result) => {
    const builder = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockResolvedValue(result);
    return builder;
  };

  it("filtra por repartidor_id y por estados en curso (creado, en_ruta)", async () => {
    const despachoBuilder = buildDespachoQuery({ data: null, error: null });
    supabase.from.mockReturnValue(despachoBuilder);

    await dispatchService.obtenerRutaActivaRepartidor("rep-1");

    expect(supabase.from).toHaveBeenCalledWith("despachos");
    expect(despachoBuilder.eq).toHaveBeenCalledWith("repartidor_id", "rep-1");
    expect(despachoBuilder.in).toHaveBeenCalledWith("estado", [
      "creado",
      "en_ruta",
    ]);
    expect(despachoBuilder.limit).toHaveBeenCalledWith(1);
  });

  it("retorna null cuando el repartidor no tiene ninguna ruta activa", async () => {
    supabase.from.mockReturnValue(
      buildDespachoQuery({ data: null, error: null }),
    );

    const resultado =
      await dispatchService.obtenerRutaActivaRepartidor("rep-1");

    expect(resultado).toBeNull();
  });

  it("retorna el despacho junto con sus pedidos cuando sí hay una ruta activa", async () => {
    const despacho = {
      id: "desp-1",
      codigo_despacho: "DES-001",
      estado: "en_ruta",
    };
    const pedidos = [{ id: "dp-1", estado_entrega: "pendiente" }];

    supabase.from.mockImplementation((table) => {
      if (table === "despachos") {
        return buildDespachoQuery({ data: despacho, error: null });
      }
      if (table === "despachos_pedidos") {
        return buildDetallesQuery({ data: pedidos, error: null });
      }
      throw new Error(`Tabla inesperada en el mock: ${table}`);
    });

    const resultado =
      await dispatchService.obtenerRutaActivaRepartidor("rep-1");

    expect(resultado).toEqual({ despacho, pedidos });
  });

  it("propaga el error si falla la consulta del despacho activo", async () => {
    supabase.from.mockReturnValue(
      buildDespachoQuery({ data: null, error: { message: "timeout" } }),
    );

    await expect(
      dispatchService.obtenerRutaActivaRepartidor("rep-1"),
    ).rejects.toThrow("Error al obtener tu ruta activa: timeout");
  });
});
