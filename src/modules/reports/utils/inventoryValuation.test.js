import { describe, expect, it } from "vitest";
import { resumirBodega, resumirRango, valorUnitario, valoresBodega } from "./inventoryValuation";

const filaRango = (extra = {}) => ({
  inicial: 10,
  compras: 5,
  ventas: 8,
  ajustes: 0,
  fisicoFinal: 7,
  preventa: 2,
  disponible: 5,
  costoUnitario: 100,
  precioVenta: 150,
  ...extra,
});

describe("valorUnitario", () => {
  it("usa el costo o el precio de venta según la base", () => {
    expect(valorUnitario(filaRango(), "costo")).toBe(100);
    expect(valorUnitario(filaRango(), "venta")).toBe(150);
  });

  it("vale 0 a costo cuando el producto no tiene costo", () => {
    expect(valorUnitario(filaRango({ costoUnitario: null }), "costo")).toBe(0);
  });
});

describe("resumirRango", () => {
  it("suma cantidades y valores por columna", () => {
    const { totales } = resumirRango([filaRango(), filaRango({ disponible: 1, costoUnitario: 200 })], "costo");
    expect(totales.disponible.cantidad).toBe(6);
    expect(totales.disponible.valor).toBe(5 * 100 + 1 * 200);
    expect(totales.compras.valor).toBe(5 * 100 + 5 * 200);
  });

  it("cuenta los productos sin costo", () => {
    const { sinCosto } = resumirRango([filaRango(), filaRango({ costoUnitario: null })], "venta");
    expect(sinCosto).toBe(1);
  });
});

describe("valoresBodega", () => {
  const fila = { disponible: 4, pendiente: 2, ventaPendiente: 400, costoUnitario: 100, precioVenta: 150 };

  it("valora lo disponible a precio de lista y lo pendiente al importe real del pedido", () => {
    const v = valoresBodega(fila);
    expect(v.total).toBe(6);
    expect(v.costoTotal).toBe(600);
    expect(v.ventaDisponible).toBe(600);
    expect(v.ventaPendiente).toBe(400);
    expect(v.gananciaDisponible).toBe(200);
    expect(v.gananciaPendiente).toBe(200);
  });

  it("no cuenta ganancia cuando no hay costo", () => {
    const v = valoresBodega({ ...fila, costoUnitario: null });
    expect(v.conCosto).toBe(false);
    expect(v.costoTotal).toBe(0);
    expect(v.gananciaDisponible).toBe(0);
    expect(v.gananciaPendiente).toBe(0);
  });
});

describe("resumirBodega", () => {
  it("totaliza y separa lo que no tiene costo", () => {
    const resumen = resumirBodega([
      { disponible: 4, pendiente: 2, ventaPendiente: 400, costoUnitario: 100, precioVenta: 150 },
      { disponible: 1, pendiente: 0, ventaPendiente: 0, costoUnitario: null, precioVenta: 50 },
    ]);
    expect(resumen.disponible).toBe(5);
    expect(resumen.total).toBe(7);
    expect(resumen.ventaTotal).toBe(600 + 400 + 50);
    expect(resumen.gananciaTotal).toBe(400);
    expect(resumen.productosSinCosto).toBe(1);
    expect(resumen.ventaSinCosto).toBe(50);
  });
});
