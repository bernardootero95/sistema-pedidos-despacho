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

  const schema = [
    { column: "Código", type: String, value: (fila) => fila.codigo, width: 15 },
    { column: "Producto", type: String, value: (fila) => fila.nombre, width: 40 },
    { column: "Cantidad", type: Number, value: (fila) => fila.cantidad_total, width: 12 },
    { column: "Valor total", type: Number, format: "#,##0", value: (fila) => fila.monto_total, width: 16 },
    { column: "# Pedidos", type: Number, value: (fila) => fila.pedidos_count, width: 12 },
  ];

  await writeXlsxFile(filas, { schema, fileName: filename });
};
