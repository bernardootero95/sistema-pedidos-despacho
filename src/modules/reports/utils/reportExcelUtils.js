// src/modules/reports/utils/reportExcelUtils.js
import { exportarLibroExcel } from "../../../utils/excelExport";

/**
 * Exporta el informe de productos a un .xlsx descargable.
 *
 * @param {Array<{codigo: string, nombre: string, cantidad_total: number, monto_total: number, pedidos_count: number}>} filas
 * @param {string} filename
 */
export const exportarInformeExcel = async (filas, filename) => {
  // `header` lleva fontWeight porque write-excel-file v4 ya no aplica
  // negrita a la fila de encabezado por defecto.
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

  await exportarLibroExcel([{ sheet: "Productos", data: filas, columns }], filename);
};
