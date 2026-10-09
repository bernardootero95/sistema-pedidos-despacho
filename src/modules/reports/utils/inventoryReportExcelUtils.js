// src/modules/reports/utils/inventoryReportExcelUtils.js
import { COLUMNAS_RANGO, resumirBodega, valorColumnaRango, valoresBodega } from "./inventoryValuation";

const encabezado = (value) => ({ value, fontWeight: "bold" });

const columnaNumero = (titulo, obtener, { formato = "#,##0.##", ancho = 14 } = {}) => ({
  header: encabezado(titulo),
  cell: (fila) => ({ value: obtener(fila), type: Number, format: formato }),
  width: ancho,
});

const columnaTexto = (titulo, obtener, ancho) => ({
  header: encabezado(titulo),
  cell: (fila) => ({ value: obtener(fila), type: String }),
  width: ancho,
});

const hojaDosColumnas = (nombre, filas) => ({
  sheet: nombre,
  data: filas,
  columns: [
    columnaTexto("Concepto", (f) => f.concepto, 45),
    {
      header: encabezado("Valor"),
      cell: (f) => ({ value: f.valor ?? null, type: Number, format: f.formato || "#,##0" }),
      width: 18,
    },
  ],
});

/**
 * Exporta el informe de inventario por rango a .xlsx ("Resumen" y "Por
 * producto"). Mismo mecanismo que profitReportExcelUtils.js.
 *
 * @param {{ periodo: string, base: "costo"|"venta", filas: Array<Object>, totales: Object, nombreArchivo: string }} informe
 */
export const exportarInventarioRangoExcel = async ({ periodo, base, filas, totales, nombreArchivo }) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const etiquetaBase = base === "costo" ? "precio de costo" : "precio de venta";

  const resumen = hojaDosColumnas("Resumen", [
    { concepto: `Informe de Inventario — ${periodo}` },
    { concepto: `Valorado a ${etiquetaBase}` },
    {},
    ...COLUMNAS_RANGO.flatMap(({ clave, etiqueta }) => [
      { concepto: `${etiqueta} (unidades)`, valor: totales[clave].cantidad, formato: "#,##0.##" },
      { concepto: `${etiqueta} (valor)`, valor: totales[clave].valor },
    ]),
  ]);

  const detalle = {
    sheet: "Por producto",
    data: filas,
    stickyRowsCount: 1,
    columns: [
      columnaTexto("Código", (f) => f.codigo, 14),
      columnaTexto("Producto", (f) => f.nombre, 40),
      ...COLUMNAS_RANGO.map(({ clave, etiqueta }) => columnaNumero(etiqueta, (f) => f[clave])),
      columnaNumero("Costo unitario", (f) => f.costoUnitario, { formato: "#,##0" }),
      columnaNumero("Precio de venta", (f) => f.precioVenta, { formato: "#,##0" }),
      columnaNumero(`Valor disponible (${etiquetaBase})`, (f) => valorColumnaRango(f, "disponible", base), {
        formato: "#,##0",
        ancho: 24,
      }),
    ],
  };

  await writeXlsxFile([resumen, detalle]).toFile(`${nombreArchivo}.xlsx`);
};

/**
 * Exporta el inventario de la bodega (disponible + pendiente por entregar)
 * con valores a costo, a venta y ganancia posible. Sirve también como hoja
 * de apoyo para la toma física.
 *
 * @param {{ fecha: string, filas: Array<Object>, nombreArchivo: string }} informe
 */
export const exportarBodegaExcel = async ({ fecha, filas, nombreArchivo }) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const resumen = resumirBodega(filas);

  const hojaResumen = hojaDosColumnas("Resumen", [
    { concepto: `Inventario de bodega — ${fecha}` },
    {},
    { concepto: "Unidades disponibles", valor: resumen.disponible, formato: "#,##0.##" },
    { concepto: "Unidades pendientes por entregar", valor: resumen.pendiente, formato: "#,##0.##" },
    { concepto: "Unidades en bodega", valor: resumen.total, formato: "#,##0.##" },
    { concepto: "Costo disponible", valor: resumen.costoDisponible },
    { concepto: "Costo pendiente por entregar", valor: resumen.costoPendiente },
    { concepto: "Costo total", valor: resumen.costoTotal },
    { concepto: "Venta disponible", valor: resumen.ventaDisponible },
    { concepto: "Venta pendiente por entregar", valor: resumen.ventaPendiente },
    { concepto: "Venta total", valor: resumen.ventaTotal },
    { concepto: "Ganancia posible total (solo productos con costo)", valor: resumen.gananciaTotal },
  ]);

  const hojaDetalle = {
    sheet: "Por producto",
    data: filas.map((fila) => ({ ...fila, ...valoresBodega(fila) })),
    stickyRowsCount: 1,
    columns: [
      columnaTexto("Código", (f) => f.codigo, 14),
      columnaTexto("Producto", (f) => f.nombre, 40),
      columnaNumero("Disponible", (f) => f.disponible),
      columnaNumero("Pendiente por entregar", (f) => f.pendiente, { ancho: 20 }),
      columnaNumero("Total en bodega", (f) => f.total),
      columnaNumero("Costo unitario", (f) => f.costoUnitario, { formato: "#,##0" }),
      columnaNumero("Precio de venta", (f) => f.precioVenta, { formato: "#,##0" }),
      columnaNumero("Costo total", (f) => f.costoTotal, { formato: "#,##0" }),
      columnaNumero("Venta total", (f) => f.ventaTotal, { formato: "#,##0" }),
      columnaNumero("Ganancia posible", (f) => f.gananciaDisponible + f.gananciaPendiente, { formato: "#,##0" }),
    ],
  };

  await writeXlsxFile([hojaResumen, hojaDetalle]).toFile(`${nombreArchivo}.xlsx`);
};
