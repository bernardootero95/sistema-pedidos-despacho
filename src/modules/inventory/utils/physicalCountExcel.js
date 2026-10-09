// src/modules/inventory/utils/physicalCountExcel.js
import { readSheet } from "read-excel-file/browser";
import { cruzarConteosImportados } from "./physicalCountCalc";

const normalizarEncabezado = (valor) => String(valor ?? "").trim().toLowerCase();

const encabezado = (value) => ({ value, fontWeight: "bold" });

/**
 * Exporta la hoja de conteo: código, producto y lo que dice el sistema, con la
 * columna "contado" vacía (o con lo ya digitado) para llenarla en bodega e
 * importarla de vuelta. Mismo mecanismo que los demás Excel del proyecto.
 *
 * @param {{ lineas: Array<Object>, contados: Record<string, number|null>, nombreArchivo: string }} datos
 */
export const exportarHojaConteo = async ({ lineas, contados, nombreArchivo }) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  await writeXlsxFile([
    {
      sheet: "Conteo",
      data: lineas,
      stickyRowsCount: 1,
      columns: [
        { header: encabezado("codigo"), cell: (l) => ({ value: l.codigo, type: String }), width: 16 },
        { header: encabezado("producto"), cell: (l) => ({ value: l.nombre, type: String }), width: 40 },
        {
          header: encabezado("sistema"),
          cell: (l) => ({ value: l.cantidadSistema, type: Number, format: "#,##0.##" }),
          width: 12,
        },
        {
          header: encabezado("contado"),
          cell: (l) => ({ value: contados[l.productoId] ?? null, type: Number, format: "#,##0.##" }),
          width: 12,
        },
      ],
    },
  ]).toFile(`${nombreArchivo}.xlsx`);
};

/**
 * Lee un Excel de conteo (columnas `codigo` y `contado`; el resto se ignora) y
 * lo cruza con los productos de la toma. No lanza por filas individuales
 * inválidas: las devuelve en `errores`.
 */
export const leerConteoDesdeExcel = async (file, productos) => {
  const filas = await readSheet(file);

  if (filas.length === 0) {
    throw new Error("El archivo está vacío.");
  }

  const encabezados = filas[0].map(normalizarEncabezado);
  const idxCodigo = encabezados.indexOf("codigo");
  const idxContado = encabezados.indexOf("contado");
  if (idxCodigo === -1 || idxContado === -1) {
    throw new Error('El archivo debe tener las columnas "codigo" y "contado" en la primera fila.');
  }

  const filasExcel = filas
    .slice(1)
    .map((fila, i) => ({ codigo: fila[idxCodigo], contado: fila[idxContado], fila: i + 2 }))
    .filter(({ codigo, contado }) => String(codigo ?? "").trim() !== "" || String(contado ?? "").trim() !== "");

  return { ...cruzarConteosImportados(filasExcel, productos), totalFilas: filasExcel.length };
};
