// src/modules/inventory/utils/physicalCountCalc.js

/**
 * Cálculo de diferencias de la toma física. Convención: diferencia =
 * contado − sistema, así un faltante es negativo y un sobrante positivo.
 * El servidor aplica el mismo delta (aplicar_toma_fisica); acá se calcula
 * para mostrar el efecto antes de aplicar.
 */

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Convierte lo digitado en el campo de conteo: "" → null (no contado),
 * "12,5" o "12.5" → 12.5, cualquier otra cosa → NaN. Acepta coma decimal
 * porque es como se escribe en Colombia.
 */
export const parseCantidadContada = (texto) => {
  const limpio = String(texto ?? "")
    .trim()
    .replace(",", ".");
  if (limpio === "") return null;
  if (!/^\d+(\.\d+)?$/.test(limpio)) return Number.NaN;
  return Number(limpio);
};

/** Diferencia de una fila (contado − sistema); null si no se ha contado. */
export const diferenciaFila = (cantidadSistema, contado) =>
  contado === null || contado === undefined ? null : redondear(contado - cantidadSistema);

const valorUnitario = (fila, base) => (base === "costo" ? (fila.costoUnitario ?? 0) : fila.precioVenta);

/**
 * Resumen de la toma. `contados` es un objeto productoId → número|null con el
 * conteo vigente (lo guardado más lo digitado sin guardar).
 */
export const resumirToma = (filas, contados) => {
  const resumen = {
    productos: filas.length,
    contados: 0,
    sinContar: 0,
    conDiferencia: 0,
    faltanteUnidades: 0,
    sobranteUnidades: 0,
    faltanteCosto: 0,
    sobranteCosto: 0,
    netoCosto: 0,
    netoVenta: 0,
  };

  filas.forEach((fila) => {
    const diferencia = diferenciaFila(fila.cantidadSistema, contados[fila.productoId]);
    if (diferencia === null) {
      resumen.sinContar += 1;
      return;
    }
    resumen.contados += 1;
    if (diferencia === 0) return;

    resumen.conDiferencia += 1;
    const costo = diferencia * valorUnitario(fila, "costo");
    resumen.netoCosto += costo;
    resumen.netoVenta += diferencia * valorUnitario(fila, "venta");
    if (diferencia < 0) {
      resumen.faltanteUnidades += -diferencia;
      resumen.faltanteCosto += -costo;
    } else {
      resumen.sobranteUnidades += diferencia;
      resumen.sobranteCosto += costo;
    }
  });

  return resumen;
};

/**
 * Cruza las filas de un Excel de conteo (ya leídas: { codigo, contado, fila })
 * con los productos de la toma. Devuelve los conteos a aplicar y los errores
 * por fila, sin lanzar: el usuario decide si continúa con las filas válidas.
 */
export const cruzarConteosImportados = (filasExcel, productos) => {
  const porCodigo = new Map(productos.map((p) => [String(p.codigo).trim().toLowerCase(), p]));
  const conteos = new Map();
  const errores = [];

  filasExcel.forEach(({ codigo, contado, fila }) => {
    const producto = porCodigo.get(String(codigo ?? "").trim().toLowerCase());
    if (!producto) {
      errores.push({ fila, motivo: `El código "${codigo ?? ""}" no existe en esta toma.` });
      return;
    }

    const cantidad = parseCantidadContada(contado);
    if (cantidad === null) return; // celda vacía: producto no contado
    if (Number.isNaN(cantidad)) {
      errores.push({ fila, motivo: `Cantidad inválida para "${codigo}": "${contado}".` });
      return;
    }

    // Si el código se repite gana la última fila (como un upsert).
    conteos.set(producto.productoId, cantidad);
  });

  return { conteos, errores };
};
