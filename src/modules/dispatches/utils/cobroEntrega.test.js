import { describe, it, expect } from "vitest";
import {
  calcularSaldo,
  pedidosPorCobrar,
  requiereCobroAlEntregar,
} from "./cobroEntrega";

const apagado = { metodosPagoActivo: false, abonosPedidosActivo: false };

describe("calcularSaldo", () => {
  it("resta lo pagado del total y nunca baja de cero", () => {
    expect(calcularSaldo({ total: "18000", total_pagado: "5000" })).toBe(13000);
    expect(calcularSaldo({ total: 100, total_pagado: 150 })).toBe(0);
    expect(calcularSaldo({ total: 100 })).toBe(100);
    expect(calcularSaldo(null)).toBe(0);
  });
});

describe("requiereCobroAlEntregar", () => {
  const pedido = { total: 1000, total_pagado: 0 };

  it("no pide cobro con las opciones apagadas", () => {
    expect(requiereCobroAlEntregar(pedido, apagado)).toBe(false);
  });

  it("pide cobro con métodos de pago o con abonos activos", () => {
    expect(requiereCobroAlEntregar(pedido, { ...apagado, metodosPagoActivo: true })).toBe(true);
    expect(requiereCobroAlEntregar(pedido, { ...apagado, abonosPedidosActivo: true })).toBe(true);
  });

  it("no pide cobro si el pedido ya está pagado", () => {
    const pagado = { total: 1000, total_pagado: 1000 };
    expect(requiereCobroAlEntregar(pagado, { metodosPagoActivo: true, abonosPedidosActivo: true })).toBe(false);
  });
});

describe("pedidosPorCobrar", () => {
  it("devuelve solo los pendientes de entrega que aún tienen saldo", () => {
    const items = [
      { estado_entrega: "pendiente", pedido: { id: "a", total: 100, total_pagado: 0 } },
      { estado_entrega: "pendiente", pedido: { id: "b", total: 100, total_pagado: 100 } },
      { estado_entrega: "entregado", pedido: { id: "c", total: 100, total_pagado: 0 } },
      { estado_entrega: "rechazado", pedido: { id: "d", total: 100, total_pagado: 0 } },
    ];
    expect(pedidosPorCobrar(items).map((p) => p.id)).toEqual(["a"]);
  });

  it("tolera una lista vacía", () => {
    expect(pedidosPorCobrar()).toEqual([]);
  });
});
