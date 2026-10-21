import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingle = vi.fn();
vi.mock("../../../config/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

import { cobroEntregaService } from "./cobroEntregaService";

const activo = { metodosPagoActivo: true, abonosPedidosActivo: true };
// La pantalla todavía muestra el pedido sin el abono.
const pedidoViejo = { id: "p1", total: "36000", total_pagado: "0" };

describe("cobroEntregaService.pedidoPorCobrar", () => {
  beforeEach(() => maybeSingle.mockReset());

  it("devuelve null sin consultar si la pantalla ya ve el pedido pagado", async () => {
    const pagado = { ...pedidoViejo, total_pagado: "36000" };
    expect(await cobroEntregaService.pedidoPorCobrar(pagado, activo)).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("devuelve null si el servidor dice que el abono ya cubrió el total", async () => {
    maybeSingle.mockResolvedValue({ data: { total: "36000", total_pagado: "36000" }, error: null });
    expect(await cobroEntregaService.pedidoPorCobrar(pedidoViejo, activo)).toBeNull();
  });

  it("devuelve el pedido con el saldo vigente si aún queda por cobrar", async () => {
    maybeSingle.mockResolvedValue({ data: { total: "36000", total_pagado: "10000" }, error: null });
    const vigente = await cobroEntregaService.pedidoPorCobrar(pedidoViejo, activo);
    expect(vigente).toMatchObject({ id: "p1", total_pagado: "10000" });
  });

  it("si no puede consultar, conserva los datos de la pantalla", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "sin red" } });
    expect(await cobroEntregaService.pedidoPorCobrar(pedidoViejo, activo)).toBe(pedidoViejo);
  });
});
