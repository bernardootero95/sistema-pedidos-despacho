import { describe, it, expect } from "vitest";
import { resumirPagosParaTicket } from "./ticketPagos";

const efectivo = { nombre: "Efectivo", es_efectivo: true };
const transferencia = { nombre: "Transferencia", es_efectivo: false };

describe("resumirPagosParaTicket", () => {
  it("devuelve null si el pedido está pagado solo en efectivo (ticket sin cambios)", () => {
    const pedido = { total: 9000, pagos: [{ tipo: "entrega", monto: 9000, metodo: efectivo }] };
    expect(resumirPagosParaTicket(pedido)).toBeNull();
  });

  it("devuelve null sin pagos y sin saldo (pedido en cero)", () => {
    expect(resumirPagosParaTicket({ total: 0, pagos: [] })).toBeNull();
  });

  it("agrupa por método y muestra el pago mixto", () => {
    const pedido = {
      total: 9000,
      pagos: [
        { tipo: "abono", monto: 4000, metodo: efectivo },
        { tipo: "entrega", monto: 3000, metodo: efectivo },
        { tipo: "entrega", monto: 2000, metodo: transferencia },
      ],
    };
    const resumen = resumirPagosParaTicket(pedido);
    expect(resumen.lineas).toEqual([
      { nombre: "Efectivo", esEfectivo: true, monto: 7000 },
      { nombre: "Transferencia", esEfectivo: false, monto: 2000 },
    ]);
    expect(resumen.pagado).toBe(9000);
    expect(resumen.saldo).toBe(0);
  });

  it("descuenta las devoluciones del método correspondiente", () => {
    const pedido = {
      total: 5000,
      pagos: [
        { tipo: "abono", monto: 8000, metodo: transferencia },
        { tipo: "devolucion", monto: 3000, metodo: transferencia },
      ],
    };
    const resumen = resumirPagosParaTicket(pedido);
    expect(resumen.lineas).toEqual([
      { nombre: "Transferencia", esEfectivo: false, monto: 5000 },
    ]);
  });

  it("informa el saldo cuando el pedido tiene abonos sin cubrir el total", () => {
    const pedido = {
      total: 18000,
      pagos: [{ tipo: "abono", monto: 5000, metodo: efectivo }],
    };
    const resumen = resumirPagosParaTicket(pedido);
    expect(resumen.pagado).toBe(5000);
    expect(resumen.saldo).toBe(13000);
  });

  it("no incluye métodos cuyo neto quedó en cero", () => {
    const pedido = {
      total: 1000,
      pagos: [
        { tipo: "abono", monto: 500, metodo: transferencia },
        { tipo: "devolucion", monto: 500, metodo: transferencia },
        { tipo: "entrega", monto: 1000, metodo: efectivo },
      ],
    };
    expect(resumirPagosParaTicket(pedido)).toBeNull();
  });
});
