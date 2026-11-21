import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../../config/supabase";
import { purchaseService } from "./purchaseService";

vi.mock("../../../config/supabase", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

// Query builder encadenable de PostgREST que registra cada llamada.
const crearQueryMock = (resultado) => {
  const llamadas = [];
  const query = {};
  for (const metodo of ["select", "is", "order", "ilike", "eq"]) {
    query[metodo] = vi.fn((...args) => {
      llamadas.push([metodo, ...args]);
      return query;
    });
  }
  query.range = vi.fn(() => Promise.resolve(resultado));
  return { query, llamadas };
};

describe("purchaseService.getComprasPaginadas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtra compras vigentes por estado de recepción", async () => {
    const { query, llamadas } = crearQueryMock({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(query);

    await purchaseService.getComprasPaginadas(1, 10, "", { estadoRecepcion: "pendiente" });

    expect(llamadas).toContainEqual(["eq", "estado", "registrada"]);
    expect(llamadas).toContainEqual(["eq", "estado_recepcion", "pendiente"]);
  });

  it("sin filtro no restringe por estado", async () => {
    const { query, llamadas } = crearQueryMock({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(query);

    await purchaseService.getComprasPaginadas(1, 10, "");

    expect(llamadas.some(([metodo]) => metodo === "eq")).toBe(false);
  });

  it("desambigua el embed de perfiles con el nombre de la FK", async () => {
    const { query } = crearQueryMock({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(query);

    await purchaseService.getComprasPaginadas();

    const [columnas] = query.select.mock.calls[0];
    expect(columnas).toContain("perfiles!compras_cabecera_usuario_id_fkey");
  });
});

describe("purchaseService RPC de recepción", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crear envía el estado de recepción elegido", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "c1" }, error: null });

    await purchaseService.crearCompraTransaccional(
      { proveedor_id: "p1", fecha_compra: "2026-11-21", estado_recepcion: "pendiente" },
      [{ producto_id: "x", cantidad: 1, costo_unitario: 10 }],
    );

    const [nombre, params] = supabase.rpc.mock.calls[0];
    expect(nombre).toBe("crear_compra_transaccional");
    expect(params.p_estado_recepcion).toBe("pendiente");
  });

  it("crear usa 'recibida' por defecto", async () => {
    supabase.rpc.mockResolvedValue({ data: { id: "c1" }, error: null });

    await purchaseService.crearCompraTransaccional({ proveedor_id: "p1" }, []);

    expect(supabase.rpc.mock.calls[0][1].p_estado_recepcion).toBe("recibida");
  });

  it("recibir llama a recibir_compra_transaccional con la fecha", async () => {
    supabase.rpc.mockResolvedValue({ data: { estado_recepcion: "recibida" }, error: null });

    await purchaseService.recibirCompraTransaccional("c1", "2026-11-21");

    expect(supabase.rpc).toHaveBeenCalledWith("recibir_compra_transaccional", {
      p_compra_id: "c1",
      p_fecha_recepcion: "2026-11-21",
    });
  });

  it("recibir propaga el error del servidor", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "La compra ya fue recibida." } });

    await expect(
      purchaseService.recibirCompraTransaccional("c1", "2026-11-21"),
    ).rejects.toThrow("La compra ya fue recibida.");
  });
});
