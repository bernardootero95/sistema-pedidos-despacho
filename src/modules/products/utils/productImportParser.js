import { readSheet } from "read-excel-file/browser";

const COLUMNAS_REQUERIDAS = ["cod_inv", "nom_inv", "existencia", "vtotal"];

const normalizarEncabezado = (valor) => String(valor ?? "").trim().toLowerCase();

/**
 * Lee el Excel de inventario del ERP (solo usa cod_inv, nom_inv, existencia
 * y vtotal; cualquier otra columna que traiga el archivo se ignora) y lo
 * deja listo para `productService.importarProductosExcel`.
 *
 * No lanza por filas individuales inválidas: las reporta en `errores` para
 * que el usuario decida si continúa con el resto antes de confirmar la
 * importación (los export de ERP suelen traer filas en blanco o de cierre
 * al final).
 */
export const parseProductosExcel = async (file) => {
  const filas = await readSheet(file);

  if (filas.length === 0) {
    throw new Error("El archivo está vacío.");
  }

  const encabezados = filas[0].map(normalizarEncabezado);
  const indices = {};
  for (const columna of COLUMNAS_REQUERIDAS) {
    const idx = encabezados.indexOf(columna);
    if (idx === -1) {
      throw new Error(
        `Falta la columna "${columna}" en el archivo. Columnas requeridas: ${COLUMNAS_REQUERIDAS.join(", ")}.`,
      );
    }
    indices[columna] = idx;
  }

  const productos = [];
  const errores = [];

  filas.slice(1).forEach((fila, i) => {
    const numeroFila = i + 2; // +1 por el encabezado, +1 porque las hojas empiezan en 1
    const codigo = String(fila[indices.cod_inv] ?? "").trim();
    const nombre = String(fila[indices.nom_inv] ?? "").trim();
    const existencia = fila[indices.existencia];
    const vtotal = fila[indices.vtotal];

    const filaVacia =
      !codigo && !nombre && existencia == null && vtotal == null;
    if (filaVacia) return;

    if (!codigo) {
      errores.push({ fila: numeroFila, motivo: "Sin código (cod_inv)." });
      return;
    }
    if (!nombre) {
      errores.push({ fila: numeroFila, motivo: "Sin nombre (nom_inv)." });
      return;
    }

    const disponible = Number(existencia);
    if (existencia == null || Number.isNaN(disponible) || disponible < 0) {
      errores.push({
        fila: numeroFila,
        motivo: `Existencia inválida: "${existencia ?? ""}".`,
      });
      return;
    }

    const precio_venta = Number(vtotal);
    if (vtotal == null || Number.isNaN(precio_venta) || precio_venta < 0) {
      errores.push({
        fila: numeroFila,
        motivo: `Valor total inválido: "${vtotal ?? ""}".`,
      });
      return;
    }

    productos.push({
      codigo,
      nombre,
      precio_venta,
      disponible,
    });
  });

  // Si el mismo código aparece más de una vez en el archivo, se queda la
  // última fila (mismo criterio que un upsert: la más reciente gana).
  const porCodigo = new Map();
  productos.forEach((producto) => porCodigo.set(producto.codigo, producto));

  return {
    productos: Array.from(porCodigo.values()),
    errores,
    totalFilas: filas.length - 1,
  };
};
