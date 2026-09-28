// src/modules/reports/utils/salesReportFormat.js

/**
 * Formateadores del informe de ventas, compartidos por la pantalla y los
 * exportadores (PDF carta, tiquete) para que muestren exactamente lo mismo.
 */

const formateadorMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatMoneda = (monto) => formateadorMoneda.format(monto || 0);

export const formatFechaHora = (fechaISO) =>
  fechaISO
    ? new Date(fechaISO).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente",
  despachado: "Despachado",
  entregado: "Entregado",
  devuelto: "Devuelto",
  anulado: "Anulado",
};

export const etiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || estado;
