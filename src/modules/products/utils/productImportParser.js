import { readSheet } from "read-excel-file/browser";

const normalizarEncabezado = (valor) => String(valor ?? "").trim().toLowerCase();

// Tiendana usa "-" para celdas vacías.
const textoCelda = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto === "-" ? "" : texto;
};

const numeroValido = (valor) => {
  if (valor == null || textoCelda(valor) === "") return null;
  const numero = Number(valor);
  return Number.isNaN(numero) || numero < 0 ? null : numero;
};

/**
 * Formatos de Excel aceptados. Cada uno declara sus columnas requeridas
 * (encabezado normalizado → clave interna) y cómo convertir una fila ya
 * mapeada al payload de `importar_productos_excel`. Agregar un formato nuevo
 * es agregar una entrada acá, sin tocar el recorrido del archivo.
 */
const FORMATOS = [
  {
    nombre: "ERP",
    columnas: {
      cod_inv: "codigo",
      nom_inv: "nombre",
      existencia: "existencia",
      vtotal: "precio",
    },
    // Si el mismo código se repite gana la última fila (como un upsert).
    claveUnica: (p) => p.codigo,
    convertir: (celdas) => {
      const codigo = textoCelda(celdas.codigo);
      const nombre = textoCelda(celdas.nombre);
      if (!codigo) return { error: "Sin código (cod_inv)." };
      if (!nombre) return { error: "Sin nombre (nom_inv)." };

      const disponible = numeroValido(celdas.existencia);
      if (disponible == null)
        return { error: `Existencia inválida: "${celdas.existencia ?? ""}".` };

      const precio_venta = numeroValido(celdas.precio);
      if (precio_venta == null)
        return { error: `Valor total inválido: "${celdas.precio ?? ""}".` };

      return { producto: { codigo, nombre, precio_venta, disponible } };
    },
  },
  {
    nombre: "Tiendana",
    columnas: {
      nombre: "nombre",
      precio: "precio",
      cantidad: "existencia",
      "costo del producto": "costo",
      "código (sku)": "sku",
      "código de barras": "codigo_barra",
      "categoría": "categoria",
      iva: "iva",
      inc: "inc",
    },
    // Sin código interno: el servidor asigna el consecutivo y empareja por
    // nombre, así que el nombre es la clave.
    claveUnica: (p) => p.nombre.toLowerCase(),
    convertir: (celdas) => {
      const nombre = textoCelda(celdas.nombre);
      if (!nombre) return { error: "Sin nombre." };

      const disponible = numeroValido(celdas.existencia);
      if (disponible == null)
        return { error: `Cantidad inválida: "${celdas.existencia ?? ""}".` };

      const precio_venta = numeroValido(celdas.precio);
      if (precio_venta == null)
        return { error: `Precio inválido: "${celdas.precio ?? ""}".` };

      const costo = numeroValido(celdas.costo);
      const sku = textoCelda(celdas.sku);

      return {
        producto: {
          nombre,
          precio_venta,
          disponible,
          costo,
          iva: numeroValido(celdas.iva) ?? 0,
          inc: numeroValido(celdas.inc) ?? 0,
          codigo_barra: textoCelda(celdas.codigo_barra) || null,
          categoria: textoCelda(celdas.categoria) || null,
          descripcion: sku ? `SKU: ${sku}` : null,
        },
      };
    },
  },
];

/**
 * Busca la primera fila que tenga todas las columnas de algún formato. Los
 * export de Tiendana traen un bloque de banner antes de los encabezados, así
 * que no se asume que estén en la fila 1.
 */
const detectarFormato = (filas) => {
  for (let i = 0; i < filas.length; i++) {
    const encabezados = filas[i].map(normalizarEncabezado);
    for (const formato of FORMATOS) {
      const indices = {};
      const completo = Object.entries(formato.columnas).every(
        ([encabezado, clave]) => {
          indices[clave] = encabezados.indexOf(encabezado);
          return indices[clave] !== -1;
        },
      );
      if (completo) return { formato, indices, filaEncabezado: i };
    }
  }
  return null;
};

/**
 * Lee el Excel de productos (ERP: cod_inv, nom_inv, existencia, vtotal; o
 * export de Tiendana) y lo deja listo para
 * `productService.importarProductosExcel`. Columnas no usadas se ignoran.
 *
 * No lanza por filas individuales inválidas: las reporta en `errores` para
 * que el usuario decida si continúa con el resto antes de confirmar la
 * importación (los export suelen traer filas en blanco o de cierre al final).
 */
export const parseProductosExcel = async (file) => {
  const filas = await readSheet(file);

  if (filas.length === 0) {
    throw new Error("El archivo está vacío.");
  }

  const deteccion = detectarFormato(filas);
  if (!deteccion) {
    const columnasErp = Object.keys(FORMATOS[0].columnas);
    const faltante = columnasErp.find(
      (c) => !filas[0].map(normalizarEncabezado).includes(c),
    );
    throw new Error(
      `Falta la columna "${faltante}" en el archivo. Columnas requeridas: ${columnasErp.join(", ")} (o un reporte de productos de Tiendana).`,
    );
  }

  const { formato, indices, filaEncabezado } = deteccion;
  const productos = [];
  const errores = [];
  const filasDatos = filas.slice(filaEncabezado + 1);

  filasDatos.forEach((fila, i) => {
    // +1 por el encabezado, +1 porque las hojas empiezan en 1
    const numeroFila = filaEncabezado + i + 2;
    const celdas = {};
    for (const [clave, idx] of Object.entries(indices)) celdas[clave] = fila[idx];

    const filaVacia = Object.values(celdas).every((v) => textoCelda(v) === "");
    if (filaVacia) return;

    const { producto, error } = formato.convertir(celdas);
    if (error) errores.push({ fila: numeroFila, motivo: error });
    else productos.push(producto);
  });

  const porClave = new Map();
  productos.forEach((p) => porClave.set(formato.claveUnica(p), p));

  return {
    formato: formato.nombre,
    productos: Array.from(porClave.values()),
    errores,
    totalFilas: filasDatos.length,
  };
};
