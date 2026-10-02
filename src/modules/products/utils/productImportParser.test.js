import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProductosExcel } from "./productImportParser";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../../../test/fixtures");

// Fixture generado con src/test/generate-import-fixture.mjs. Columnas:
// cod_inv, nom_inv, existencia, vtotal, columna_extra (ignorada). Incluye
// una fila en blanco, una sin nombre, una con existencia no numérica y un
// código duplicado (P002 aparece dos veces, la segunda con otros datos).
const cargarFixture = (nombreArchivo = "productos-import.xlsx") => {
  const buffer = readFileSync(path.join(FIXTURES_DIR, nombreArchivo));
  return new File([buffer], nombreArchivo, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

describe("parseProductosExcel", () => {
  it("mapea las columnas requeridas e ignora columnas extra", async () => {
    const { productos } = await parseProductosExcel(cargarFixture());
    const p001 = productos.find((p) => p.codigo === "P001");
    expect(p001).toEqual({
      codigo: "P001",
      nombre: "Producto Uno",
      precio_venta: 5000,
      disponible: 10,
    });
  });

  it("se queda con la última fila cuando el código se repite", async () => {
    const { productos } = await parseProductosExcel(cargarFixture());
    const ocurrencias = productos.filter((p) => p.codigo === "P002");
    expect(ocurrencias).toHaveLength(1);
    expect(ocurrencias[0]).toEqual({
      codigo: "P002",
      nombre: "Producto Dos Actualizado",
      precio_venta: 12500,
      disponible: 7,
    });
  });

  it("omite filas en blanco sin reportarlas como error", async () => {
    const { errores } = await parseProductosExcel(cargarFixture());
    expect(errores.some((e) => e.motivo.includes("blanco"))).toBe(false);
  });

  it("reporta filas sin nombre y con existencia inválida, sin incluirlas en productos", async () => {
    const { productos, errores } = await parseProductosExcel(cargarFixture());

    expect(productos.find((p) => p.codigo === "P003")).toBeUndefined();
    expect(
      errores.some((e) => e.fila === 5 && e.motivo.includes("nombre")),
    ).toBe(true);

    expect(productos.find((p) => p.codigo === "P004")).toBeUndefined();
    expect(
      errores.some((e) => e.fila === 6 && e.motivo.includes("Existencia")),
    ).toBe(true);
  });

  it("detecta el reporte de Tiendana con encabezados fuera de la fila 1", async () => {
    const { formato, productos, errores } = await parseProductosExcel(
      cargarFixture("productos-tiendana.xlsx"),
    );

    expect(formato).toBe("Tiendana");
    expect(productos.find((p) => p.nombre === "Base TV")).toEqual({
      nombre: "Base TV",
      precio_venta: 30000,
      disponible: 10,
      costo: 14000,
      iva: 0,
      inc: 0,
      codigo_barra: null,
      categoria: null,
      descripcion: null,
    });
    expect(productos.every((p) => p.codigo === undefined)).toBe(true);
    expect(errores).toEqual([{ fila: 6, motivo: 'Precio inválido: "-".' }]);
  });

  it("en Tiendana se queda con la última fila cuando el nombre se repite", async () => {
    const { productos } = await parseProductosExcel(
      cargarFixture("productos-tiendana.xlsx"),
    );
    const neveras = productos.filter((p) => p.nombre.toLowerCase() === "nevera uno");
    expect(neveras).toHaveLength(1);
    expect(neveras[0]).toMatchObject({
      precio_venta: 1600000,
      disponible: 3,
      costo: 1250000,
      codigo_barra: "7701",
      categoria: "NEVERAS",
      descripcion: "SKU: NEV1",
    });
  });

  it("lanza un error claro si falta una columna requerida", async () => {
    await expect(
      parseProductosExcel(
        cargarFixture("productos-import-columna-faltante.xlsx"),
      ),
    ).rejects.toThrow('Falta la columna "vtotal"');
  });
});
