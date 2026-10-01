import { describe, it, expect } from "vitest";
import { getEstadoFacturaIngefact } from "./facturaIngefactEstado";

const AHORA = new Date("2026-10-01T12:00:00Z").getTime();
const haceMinutos = (min) => new Date(AHORA - min * 60 * 1000).toISOString();

describe("getEstadoFacturaIngefact", () => {
  it("ofrece facturar un pedido entregado sin factura", () => {
    expect(getEstadoFacturaIngefact({ estado: "entregado" }, AHORA)).toEqual({
      aviso: null,
      accion: "facturar",
    });
  });

  it("no ofrece nada en un pedido no entregado sin factura", () => {
    expect(getEstadoFacturaIngefact({ estado: "pendiente" }, AHORA)).toEqual({
      aviso: null,
      accion: null,
    });
  });

  it("muestra la factura vigente sin acción", () => {
    const pedido = { estado: "entregado", ingefact_factura_id: "f1", ingefact_estado: "facturada" };
    expect(getEstadoFacturaIngefact(pedido, AHORA)).toEqual({ aviso: "vigente", accion: null });
  });

  it("bloquea la acción mientras hay una operación en curso reciente", () => {
    const pedido = { estado: "entregado", ingefact_estado: "facturando", ingefact_en_curso_desde: haceMinutos(2) };
    expect(getEstadoFacturaIngefact(pedido, AHORA)).toEqual({ aviso: "en_curso", accion: null });
  });

  it("permite reintentar una operación en curso abandonada", () => {
    const pedido = {
      estado: "anulado",
      ingefact_factura_id: "f1",
      ingefact_estado: "anulando",
      ingefact_en_curso_desde: haceMinutos(15),
    };
    expect(getEstadoFacturaIngefact(pedido, AHORA)).toEqual({ aviso: "en_curso", accion: "anular" });
  });

  it("ofrece reintentar la factura si falló la emisión", () => {
    const pedido = { estado: "entregado", ingefact_estado: "error_facturacion", ingefact_error: "x" };
    expect(getEstadoFacturaIngefact(pedido, AHORA)).toEqual({ aviso: "error", accion: "facturar" });
  });

  it("ofrece reintentar la anulación si falló y el pedido ya no está entregado", () => {
    const pedido = { estado: "devuelto", ingefact_factura_id: "f1", ingefact_estado: "error_anulacion" };
    expect(getEstadoFacturaIngefact(pedido, AHORA)).toEqual({ aviso: "error", accion: "anular" });
  });

  it("muestra la factura anulada y permite refacturar si el pedido volvió a entregarse", () => {
    const anulada = { ingefact_factura_id: "f1", ingefact_anulado_en: haceMinutos(60), ingefact_estado: "anulada" };
    expect(getEstadoFacturaIngefact({ ...anulada, estado: "anulado" }, AHORA)).toEqual({
      aviso: "anulada",
      accion: null,
    });
    expect(getEstadoFacturaIngefact({ ...anulada, estado: "entregado" }, AHORA)).toEqual({
      aviso: "anulada",
      accion: "facturar",
    });
  });
});
