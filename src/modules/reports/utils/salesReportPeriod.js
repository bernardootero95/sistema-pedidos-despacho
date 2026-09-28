// src/modules/reports/utils/salesReportPeriod.js

/**
 * Definiciones compartidas del informe de ventas (pantalla, PDF carta,
 * tiquete y Excel): tipos de informe, cálculo del rango de fechas y las
 * categorías del resumen/detalle. Un solo lugar para las etiquetas, así los
 * cuatro formatos de salida no se desalinean.
 */

export const TIPOS_INFORME_VENTAS = [
  { value: "diario", label: "Venta diaria" },
  { value: "mensual", label: "Cierre de mes" },
];

/**
 * Categorías del detalle, en el orden en que se muestran, con etiquetas
 * según el tipo de informe ("Pendientes del día" vs. "del mes"). `clave`
 * coincide con `categoria` del detalle que devuelve obtener_informe_ventas
 * y `resumen` con la clave del objeto resumen.
 */
export const obtenerCategoriasDetalle = (tipo) => {
  const esMensual = tipo === "mensual";
  return [
    { clave: "venta", resumen: "ventas", label: "Ventas (entregados)" },
    { clave: "anulado", resumen: "anulados", label: "Anulados" },
    { clave: "devuelto", resumen: "devueltos", label: "Devueltos" },
    {
      clave: "pendiente_periodo",
      resumen: "pendientes_periodo",
      label: esMensual ? "Pendientes del mes" : "Pendientes del día",
    },
    {
      clave: "pendiente_anterior",
      resumen: "pendientes_anteriores",
      label: esMensual ? "Pendientes de meses anteriores" : "Pendientes de días anteriores",
    },
  ];
};

const pad = (n) => String(n).padStart(2, "0");

/** Fecha local (no UTC) en formato YYYY-MM-DD, para inputs type="date". */
export const fechaLocalISO = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;

/** Mes local en formato YYYY-MM, para inputs type="month". */
export const mesLocalISO = (fecha = new Date()) => fechaLocalISO(fecha).slice(0, 7);

/**
 * Rango [fechaDesde, fechaHasta] (ambos inclusive, YYYY-MM-DD) según el
 * tipo de informe: el día elegido, o del 1 al último día del mes elegido.
 */
export const calcularRangoInforme = ({ tipo, fecha, mes }) => {
  if (tipo === "mensual") {
    const [anio, numeroMes] = mes.split("-").map(Number);
    // Día 0 del mes siguiente = último día de este mes.
    const ultimoDia = new Date(anio, numeroMes, 0).getDate();
    return { fechaDesde: `${mes}-01`, fechaHasta: `${mes}-${pad(ultimoDia)}` };
  }
  return { fechaDesde: fecha, fechaHasta: fecha };
};

/** Texto legible del período: "lunes, 28 de septiembre de 2026" o "septiembre de 2026". */
export const describirPeriodo = ({ tipo, fecha, mes }) => {
  if (tipo === "mensual") {
    return new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
  }
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** Título del informe según su tipo. */
export const tituloInforme = (tipo) =>
  tipo === "mensual" ? "Informe de Cierre de Mes" : "Informe de Venta Diaria";
