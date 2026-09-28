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

const CLAVES_RESUMEN = ["preventa", "ventas", "anulados", "devueltos", "pendientes_periodo", "pendientes_anteriores"];

/**
 * Normaliza el JSON de resumen_ventas_periodo (lo devuelven tanto
 * obtener_informe_ventas como obtener_resumen_dashboard): NUMERIC llega
 * como string vía PostgREST y un resumen ausente se completa en cero, para
 * que ningún consumidor tenga que defenderse de eso.
 */
export const normalizarResumenVentas = (resumen) =>
  Object.fromEntries(
    CLAVES_RESUMEN.map((clave) => [
      clave,
      {
        cantidad: Number(resumen?.[clave]?.cantidad) || 0,
        monto: Number(resumen?.[clave]?.monto) || 0,
      },
    ]),
  );
