// src/modules/reports/utils/inventoryValuation.js

/**
 * Valoración de los informes de inventario (por rango y bodega actual),
 * compartida por pantalla y Excel. Las cantidades las calcula el servidor;
 * acá solo se multiplican por el costo o el precio de venta de cada fila.
 *
 * Un producto sin costo conocido (`costoUnitario` null) vale 0 a costo y
 * queda fuera de la ganancia, para no inflarla con ventas sin costo (mismo
 * criterio que el informe de utilidad).
 */

export const BASES_VALOR = [
  { valor: "costo", etiqueta: "Precio de costo" },
  { valor: "venta", etiqueta: "Precio de venta" },
];

export const COLUMNAS_RANGO = [
  { clave: "inicial", etiqueta: "Inventario inicial" },
  { clave: "compras", etiqueta: "Compras" },
  { clave: "ventas", etiqueta: "Ventas (entregados)" },
  { clave: "ajustes", etiqueta: "Ajustes toma física" },
  { clave: "fisicoFinal", etiqueta: "Físico final" },
  { clave: "preventa", etiqueta: "Preventa (por entregar)" },
  { clave: "disponible", etiqueta: "Disponible" },
];

const tieneCosto = (fila) => fila.costoUnitario !== null && fila.costoUnitario !== undefined;

/** Precio unitario según la base elegida; 0 si se pide costo y no hay. */
export const valorUnitario = (fila, base) =>
  base === "costo" ? (tieneCosto(fila) ? fila.costoUnitario : 0) : fila.precioVenta;

/** Valor de una columna de cantidad de una fila del informe por rango. */
export const valorColumnaRango = (fila, clave, base) => fila[clave] * valorUnitario(fila, base);

/**
 * Totales por columna del informe por rango: cantidad y valor. `sinCosto`
 * cuenta los productos con existencia o movimiento pero sin costo, para
 * avisar que a costo están subvalorados.
 */
export const resumirRango = (filas, base) => {
  const totales = {};
  COLUMNAS_RANGO.forEach(({ clave }) => {
    totales[clave] = { cantidad: 0, valor: 0 };
  });

  let sinCosto = 0;
  filas.forEach((fila) => {
    COLUMNAS_RANGO.forEach(({ clave }) => {
      totales[clave].cantidad += fila[clave];
      totales[clave].valor += valorColumnaRango(fila, clave, base);
    });
    if (!tieneCosto(fila)) sinCosto += 1;
  });

  return { totales, sinCosto };
};

/**
 * Valores de una fila de la bodega actual. La venta de lo pendiente es el
 * importe real de los pedidos (respeta el tipo de precio de cada uno); la de
 * lo disponible es cantidad × precio de venta de lista.
 */
export const valoresBodega = (fila) => {
  const conCosto = tieneCosto(fila);
  const costoDisponible = conCosto ? fila.disponible * fila.costoUnitario : 0;
  const costoPendiente = conCosto ? fila.pendiente * fila.costoUnitario : 0;
  const ventaDisponible = fila.disponible * fila.precioVenta;
  const ventaPendiente = fila.ventaPendiente;

  return {
    conCosto,
    total: fila.disponible + fila.pendiente,
    costoDisponible,
    costoPendiente,
    costoTotal: costoDisponible + costoPendiente,
    ventaDisponible,
    ventaPendiente,
    ventaTotal: ventaDisponible + ventaPendiente,
    // La ganancia solo cuenta filas con costo conocido.
    gananciaDisponible: conCosto ? ventaDisponible - costoDisponible : 0,
    gananciaPendiente: conCosto ? ventaPendiente - costoPendiente : 0,
  };
};

const RESUMEN_BODEGA_VACIO = {
  disponible: 0,
  pendiente: 0,
  total: 0,
  costoDisponible: 0,
  costoPendiente: 0,
  costoTotal: 0,
  ventaDisponible: 0,
  ventaPendiente: 0,
  ventaTotal: 0,
  gananciaDisponible: 0,
  gananciaPendiente: 0,
  gananciaTotal: 0,
  ventaSinCosto: 0,
  productosSinCosto: 0,
};

/** Totales de la bodega actual (cantidades, costo, venta y ganancia posible). */
export const resumirBodega = (filas) => {
  const resumen = { ...RESUMEN_BODEGA_VACIO };

  filas.forEach((fila) => {
    const v = valoresBodega(fila);
    resumen.disponible += fila.disponible;
    resumen.pendiente += fila.pendiente;
    resumen.total += v.total;
    resumen.costoDisponible += v.costoDisponible;
    resumen.costoPendiente += v.costoPendiente;
    resumen.costoTotal += v.costoTotal;
    resumen.ventaDisponible += v.ventaDisponible;
    resumen.ventaPendiente += v.ventaPendiente;
    resumen.ventaTotal += v.ventaTotal;
    resumen.gananciaDisponible += v.gananciaDisponible;
    resumen.gananciaPendiente += v.gananciaPendiente;
    if (!v.conCosto) {
      resumen.productosSinCosto += 1;
      resumen.ventaSinCosto += v.ventaTotal;
    }
  });

  resumen.gananciaTotal = resumen.gananciaDisponible + resumen.gananciaPendiente;
  return resumen;
};
