// src/utils/excelExport.js

/**
 * Convierte cada hoja `{ sheet, data: Object[], columns, ... }` al formato que
 * espera write-excel-file v4 con varias hojas: `data` como filas (arrays de
 * celdas, con el encabezado primero). En ese modo la librería no aplica
 * `columns` para transformar objetos — solo lo hace con una única hoja — y
 * lanza "Expected each sheet data row to be an array". `columns` se conserva
 * porque de ahí toma el ancho de cada columna.
 *
 * @param {Array<{ data: Array<Object>, columns: Array<Object> }>} hojas
 * @param {(objetos: Array<Object>, columnas: Array<Object>) => Array<Array>} getSheetData
 */
export const prepararHojas = (hojas, getSheetData) =>
  hojas.map((hoja) => ({
    ...hoja,
    data: getSheetData(hoja.data, hoja.columns),
  }));

/**
 * Genera y descarga un .xlsx con una o varias hojas definidas por columnas.
 * Import dinámico (build de navegador) para no engordar el chunk inicial de
 * las páginas que exportan.
 *
 * @param {Array<{ sheet: string, data: Array<Object>, columns: Array<Object> }>} hojas
 * @param {string} nombreArchivo Nombre con extensión .xlsx
 */
export const exportarLibroExcel = async (hojas, nombreArchivo) => {
  const { default: writeXlsxFile, getSheetData } = await import("write-excel-file/browser");

  // writeXlsxFile() del build de navegador devuelve sincrónicamente
  // { toBlob, toFile }; toFile() genera el archivo y dispara la descarga.
  await writeXlsxFile(prepararHojas(hojas, getSheetData)).toFile(nombreArchivo);
};
