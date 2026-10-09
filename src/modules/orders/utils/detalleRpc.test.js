import { describe, expect, it } from "vitest";
import { armarDetalleRpc } from "./detalleRpc";

describe("armarDetalleRpc", () => {
  it("no manda precio en las líneas que el servidor resuelve", () => {
    expect(
      armarDetalleRpc({ producto_id: "p1", cantidad: "2", tipo_precio: "mayorista", precio_unitario: 800 }),
    ).toEqual({ producto_id: "p1", cantidad: 2, tipo_precio: "mayorista", tipo_precio_id: null });
  });

  it("usa 'normal' por defecto", () => {
    expect(armarDetalleRpc({ producto_id: "p1", cantidad: 1 }).tipo_precio).toBe("normal");
  });

  it("manda el precio solo en las líneas de precio manual", () => {
    expect(
      armarDetalleRpc({ producto_id: "p1", cantidad: 3, tipo_precio: "manual", precio_unitario: "1250.5" }),
    ).toEqual({ producto_id: "p1", cantidad: 3, tipo_precio: "manual", tipo_precio_id: null, precio_manual: 1250.5 });
  });

  it("conserva el tipo de precio personalizado", () => {
    expect(
      armarDetalleRpc({ producto_id: "p1", cantidad: 1, tipo_precio: "personalizado", tipo_precio_id: "t1" }),
    ).toMatchObject({ tipo_precio: "personalizado", tipo_precio_id: "t1" });
  });
});
