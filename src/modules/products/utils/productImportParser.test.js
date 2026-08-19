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

  it("lanza un error claro si falta una columna requerida", async () => {
    await expect(
      parseProductosExcel(
        cargarFixture("productos-import-columna-faltante.xlsx"),
      ),
    ).rejects.toThrow('Falta la columna "vtotal"');
  });
});
