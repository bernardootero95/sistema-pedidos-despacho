// src/modules/reports/utils/priceListExcelUtils.js
import { exportarLibroExcel } from "../../../utils/excelExport";
import { formatEscalas } from "./priceList";

const encabezado = (value) => ({ value, fontWeight: "bold" });

const columnaPrecio = (titulo, obtener) => ({
  header: encabezado(titulo),
  cell: (fila) => ({ value: obtener(fila), type: Number, format: "#,##0" }),
  width: 16,
});

/**
 * Lista de precios en .xlsx: una columna por tipo de precio activo y las
 * escalas al por mayor como texto (cada producto puede tener varias).
 *
 * @param {{ filas: Array<Object>, tipos: Array<{id: string, nombre: string}>, nombreArchivo: string }} lista
 */
export const exportarListaPreciosExcel = async ({ filas, tipos, nombreArchivo }) => {
  const columns = [
    { header: encabezado("Código"), cell: (f) => ({ value: f.codigo, type: String }), width: 14 },
    { header: encabezado("Producto"), cell: (f) => ({ value: f.nombre, type: String }), width: 40 },
    { header: encabezado("Categoría"), cell: (f) => ({ value: f.categoria, type: String }), width: 20 },
    columnaPrecio("Precio de venta", (f) => f.precioVenta),
    ...tipos.map((t) => columnaPrecio(t.nombre, (f) => f.preciosTipo[t.id])),
    { header: encabezado("Por mayor"), cell: (f) => ({ value: formatEscalas(f.escalas), type: String }), width: 40 },
  ];

  await exportarLibroExcel(
    [{ sheet: "Lista de precios", data: filas, columns, stickyRowsCount: 1 }],
    `${nombreArchivo}.xlsx`,
  );
};
