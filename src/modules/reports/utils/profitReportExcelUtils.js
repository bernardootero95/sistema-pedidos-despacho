// src/modules/reports/utils/profitReportExcelUtils.js
import { calcularMargen } from "./profitReportFormat";

const encabezado = (value) => ({ value, fontWeight: "bold" });

/** Margen como fracción (0.253) para que Excel lo muestre con formato de porcentaje. */
const margenFraccion = (utilidad, ventasConCosto) => {
  const margen = calcularMargen(utilidad, ventasConCosto);
  return margen === null ? null : margen / 100;
};

/**
 * Exporta el informe de utilidad a .xlsx con dos hojas: "Resumen" y
 * "Por producto". Mismo mecanismo que salesReportExcelUtils.js:
 * write-excel-file v4, build de navegador, import dinámico.
 *
 * @param {{ periodo: string, resumen: Object, detalle: Array<Object>, nombreArchivo: string }} informe
 */
export const exportarInformeUtilidadExcel = async ({ periodo, resumen, detalle, nombreArchivo }) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const hojaResumen = {
    sheet: "Resumen",
    data: [
      { concepto: `Informe de Utilidad — ${periodo}` },
      {},
      { concepto: "Ventas (pedidos entregados)", valor: resumen.ventas },
      { concepto: "Costo de lo vendido", valor: resumen.costo },
      { concepto: "Utilidad bruta", valor: resumen.utilidad },
      {
        concepto: "Margen bruto",
        valor: margenFraccion(resumen.utilidad, resumen.ventasConCosto),
        esPorcentaje: true,
      },
      { concepto: "Pedidos entregados", valor: resumen.pedidos, esConteo: true },
      { concepto: "Ventas sin costo registrado (no incluidas en la utilidad)", valor: resumen.sinCosto.monto },
    ],
    columns: [
      {
        header: encabezado("Concepto"),
        cell: (fila) => ({ value: fila.concepto, type: String }),
        width: 55,
      },
      {
        header: encabezado("Valor"),
        cell: (fila) => ({
          value: fila.valor ?? null,
          type: Number,
          format: fila.esPorcentaje ? "0.0%" : fila.esConteo ? "0" : "#,##0",
        }),
        width: 18,
      },
    ],
  };

  const columnaMoneda = (titulo, campo) => ({
    header: encabezado(titulo),
    cell: (f) => ({ value: f[campo], type: Number, format: "#,##0" }),
    width: 16,
  });

  const hojaDetalle = {
    sheet: "Por producto",
    data: detalle,
    stickyRowsCount: 1,
    columns: [
      { header: encabezado("Código"), cell: (f) => ({ value: f.codigo, type: String }), width: 14 },
      { header: encabezado("Producto"), cell: (f) => ({ value: f.nombre, type: String }), width: 40 },
      {
        header: encabezado("Cantidad"),
        cell: (f) => ({ value: f.cantidad, type: Number, format: "#,##0.##" }),
        width: 12,
      },
      columnaMoneda("Ventas", "ventas"),
      columnaMoneda("Costo", "costo"),
      columnaMoneda("Utilidad", "utilidad"),
      {
        header: encabezado("Margen"),
        cell: (f) => ({ value: margenFraccion(f.utilidad, f.ventasConCosto), type: Number, format: "0.0%" }),
        width: 12,
      },
      columnaMoneda("Ventas sin costo", "ventasSinCosto"),
    ],
  };

  await writeXlsxFile([hojaResumen, hojaDetalle]).toFile(`${nombreArchivo}.xlsx`);
};
