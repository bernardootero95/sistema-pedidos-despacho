// src/modules/reports/utils/reportExcelUtils.js

/**
 * Exporta el informe de productos a un .xlsx descargable con
 * write-excel-file (ya usado en el proyecto para importar productos —
 * src/test/generate-import-fixture.mjs — pero desde el build de Node; acá
 * se usa el build de navegador, que dispara la descarga directamente).
 * Import dinámico por el mismo motivo que html2pdf.js en printUtils.js: no
 * engordar el chunk inicial de cada página que importe este util.
 *
 * @param {Array<{codigo: string, nombre: string, cantidad_total: number, monto_total: number, pedidos_count: number}>} filas
 * @param {string} filename
 */
export const exportarInformeExcel = async (filas, filename) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  // API v4: `schema` fue reemplazado por `columns` (header + función `cell`
  // por columna) — ver CHANGELOG de write-excel-file. `header` lleva
  // fontWeight acá porque, a diferencia de v1-v3, ya no aplica negrita a la
  // fila de encabezado por defecto.
  const columns = [
    {
      header: { value: "Código", fontWeight: "bold" },
      cell: (fila) => ({ value: fila.codigo, type: String }),
      width: 15,
    },
    {
      header: { value: "Producto", fontWeight: "bold" },
      cell: (fila) => ({ value: fila.nombre, type: String }),
      width: 40,
    },
    {
      header: { value: "Cantidad", fontWeight: "bold" },
      cell: (fila) => ({ value: fila.cantidad_total, type: Number }),
      width: 12,
    },
    {
      header: { value: "Valor total", fontWeight: "bold" },
      cell: (fila) => ({ value: fila.monto_total, type: Number, format: "#,##0" }),
      width: 16,
    },
    {
      header: { value: "# Pedidos", fontWeight: "bold" },
      cell: (fila) => ({ value: fila.pedidos_count, type: Number }),
      width: 12,
    },
  ];

  await writeXlsxFile(filas, { columns, fileName: filename });
};
