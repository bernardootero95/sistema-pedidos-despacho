// src/modules/reports/utils/salesReportExcelUtils.js
import { etiquetaEstado, formatFechaHora } from "./salesReportFormat";

const encabezado = (value) => ({ value, fontWeight: "bold" });

/**
 * Exporta el informe de ventas a .xlsx con dos hojas: "Resumen" (período,
 * vendedor y totales por concepto) y "Detalle" (un pedido por fila con su
 * categoría). Mismo mecanismo que reportExcelUtils.js: write-excel-file v4,
 * build de navegador, import dinámico.
 *
 * @param {import("./salesReportPdfUtils").InformeVentasPdf} informe
 */
export const exportarInformeVentasExcel = async (informe) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const { resumen, categorias, detalle } = informe;

  const filasResumen = [
    { concepto: "Total pedidos (preventa)", ...resumen.preventa },
    ...categorias.map((c) => ({
      concepto: c.clave === "venta" ? "Total ventas (entregados)" : c.label,
      ...resumen[c.resumen],
    })),
  ];

  const hojaResumen = {
    sheet: "Resumen",
    data: [
      { concepto: `${informe.titulo} — ${informe.periodo}` },
      { concepto: `Vendedor: ${informe.vendedorLabel || "Todos"}` },
      {},
      ...filasResumen,
    ],
    columns: [
      {
        header: encabezado("Concepto"),
        cell: (fila) => ({ value: fila.concepto, type: String }),
        width: 45,
      },
      {
        header: encabezado("Pedidos"),
        cell: (fila) => ({ value: fila.cantidad, type: Number }),
        width: 12,
      },
      {
        header: encabezado("Valor"),
        cell: (fila) => ({ value: fila.monto, type: Number, format: "#,##0" }),
        width: 18,
      },
    ],
  };

  const etiquetaCategoria = Object.fromEntries(categorias.map((c) => [c.clave, c.label]));

  // Fechas como texto en hora local: write-excel-file serializa los Date en
  // UTC y en Excel aparecerían corridas 5 horas.
  const hojaDetalle = {
    sheet: "Detalle",
    data: detalle,
    stickyRowsCount: 1,
    columns: [
      {
        header: encabezado("Categoría"),
        cell: (p) => ({ value: etiquetaCategoria[p.categoria], type: String }),
        width: 30,
      },
      {
        header: encabezado("N° pedido"),
        cell: (p) => ({ value: p.numero_pedido, type: String }),
        width: 14,
      },
      {
        header: encabezado("Fecha pedido"),
        cell: (p) => ({ value: formatFechaHora(p.fecha_pedido), type: String }),
        width: 18,
      },
      {
        header: encabezado("Fecha entrega"),
        cell: (p) => ({ value: formatFechaHora(p.fecha_entrega), type: String }),
        width: 18,
      },
      {
        header: encabezado("Cliente"),
        cell: (p) => ({ value: p.cliente, type: String }),
        width: 35,
      },
      {
        header: encabezado("Vendedor"),
        cell: (p) => ({ value: p.vendedor, type: String }),
        width: 25,
      },
      {
        header: encabezado("Estado"),
        cell: (p) => ({ value: etiquetaEstado(p.estado), type: String }),
        width: 12,
      },
      {
        header: encabezado("Total"),
        cell: (p) => ({ value: p.total, type: Number, format: "#,##0" }),
        width: 16,
      },
    ],
  };

  await writeXlsxFile([hojaResumen, hojaDetalle]).toFile(`${informe.nombreArchivo}.xlsx`);
};
