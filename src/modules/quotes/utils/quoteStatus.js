/**
 * "Vencida" no se guarda en la base de datos: una cotización vigente cuya
 * fecha de vencimiento ya pasó se considera vencida (se deriva al mostrar,
 * sin jobs que mantengan el estado).
 */

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio, como la que usa el servidor. */
export const hoyIso = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(ahora);

/** Días de vigencia que se proponen al crear una cotización. */
export const DIAS_VIGENCIA_POR_DEFECTO = 15;

/** Suma `dias` a una fecha YYYY-MM-DD y devuelve otra YYYY-MM-DD. */
export const sumarDiasIso = (fechaIso, dias) => {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

/**
 * @param {{estado: string, fecha_vencimiento: string}} cotizacion
 * @returns {"vigente"|"vencida"|"convertida"|"anulada"}
 */
export const estadoEfectivo = (cotizacion, hoy = hoyIso()) => {
  if (cotizacion.estado === "vigente" && cotizacion.fecha_vencimiento < hoy) {
    return "vencida";
  }
  return cotizacion.estado;
};

export const ESTADOS_COTIZACION = {
  vigente: { etiqueta: "Vigente", clases: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  vencida: { etiqueta: "Vencida", clases: "bg-amber-100 text-amber-800 border-amber-200" },
  convertida: { etiqueta: "Convertida", clases: "bg-blue-100 text-blue-800 border-blue-200" },
  anulada: { etiqueta: "Anulada", clases: "bg-red-100 text-red-800 border-red-200" },
};

/** Solo una cotización vigente (no vencida) se puede convertir en pedido. */
export const puedeConvertirse = (cotizacion, hoy = hoyIso()) =>
  estadoEfectivo(cotizacion, hoy) === "vigente";

/** Anular aplica a vigentes y vencidas; una convertida se gestiona desde su pedido. */
export const puedeAnularse = (cotizacion) =>
  cotizacion.estado === "vigente";
