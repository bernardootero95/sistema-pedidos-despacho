import { describe, expect, it } from "vitest";
import { getSheetData } from "write-excel-file/browser";
import writeXlsxFile from "write-excel-file/node";
import { prepararHojas } from "./excelExport";

const encabezado = (value) => ({ value, fontWeight: "bold" });

const hojas = [
  {
    sheet: "Resumen",
    data: [{ concepto: "Título" }, {}, { concepto: "Total", valor: 1500 }],
    columns: [
      {
        header: encabezado("Concepto"),
        cell: (f) => ({ value: f.concepto, type: String }),
        width: 40,
      },
      {
        header: encabezado("Valor"),
        cell: (f) => ({ value: f.valor ?? null, type: Number }),
        width: 18,
      },
    ],
  },
  {
    sheet: "Por producto",
    data: [{ codigo: "A1", cantidad: 2.5 }],
    stickyRowsCount: 1,
    columns: [
      {
        header: encabezado("Código"),
        cell: (f) => ({ value: f.codigo, type: String }),
        width: 14,
      },
      {
        header: encabezado("Cantidad"),
        cell: (f) => ({ value: f.cantidad, type: Number }),
        width: 12,
      },
    ],
  },
];

describe("prepararHojas", () => {
  it("convierte los objetos de cada hoja en filas con el encabezado primero", () => {
    const [resumen, detalle] = prepararHojas(hojas, getSheetData);

    expect(resumen.data).toHaveLength(4);
    expect(resumen.data[0].map((c) => c.value)).toEqual(["Concepto", "Valor"]);
    expect(resumen.data[3].map((c) => c.value)).toEqual(["Total", 1500]);
    expect(detalle.data[1].map((c) => c.value)).toEqual(["A1", 2.5]);
    expect(detalle.stickyRowsCount).toBe(1);
    expect(detalle.columns).toBe(hojas[1].columns);
  });

  it("produce un libro de varias hojas que write-excel-file acepta", async () => {
    expect(() => writeXlsxFile(hojas)).toThrow("Expected each sheet data row to be an array");

    const buffer = await writeXlsxFile(prepararHojas(hojas, getSheetData)).toBuffer();
    expect(buffer.length).toBeGreaterThan(0);
  });
});
