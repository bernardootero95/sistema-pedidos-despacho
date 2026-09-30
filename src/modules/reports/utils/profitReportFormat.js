// src/modules/reports/utils/profitReportFormat.js

/**
 * Formateadores del informe de utilidad, compartidos por la pantalla y el
 * exportador a Excel. Los montos se formatean con formatMoneda de
 * salesReportFormat.js.
 */

/** Margen bruto en porcentaje, o null si no hay ventas con costo para medirlo. */
export const calcularMargen = (utilidad, ventasConCosto) =>
  ventasConCosto > 0 ? (utilidad / ventasConCosto) * 100 : null;

export const formatMargen = (margen) =>
  margen === null ? "—" : `${margen.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

const formateadorCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export const formatCantidad = (cantidad) => formateadorCantidad.format(cantidad || 0);
