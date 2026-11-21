// src/modules/purchases/utils/purchaseReception.js

/**
 * Estado de recepción de una compra, independiente del estado del documento
 * (`estado`: registrada/anulada). Una compra 'pendiente' no ha sumado stock
 * ni movido el costo; se aplica al marcarla como recibida
 * (`recibir_compra_transaccional`). Recibida es definitivo: si fue un error,
 * se anula la compra.
 */
export const ESTADOS_RECEPCION = {
  RECIBIDA: "recibida",
  PENDIENTE: "pendiente",
};

export const OPCIONES_RECEPCION = [
  {
    valor: ESTADOS_RECEPCION.RECIBIDA,
    etiqueta: "Recibida",
    etiquetaPlural: "Recibidas",
    descripcion: "La mercancía ya llegó: suma al inventario al guardar.",
  },
  {
    valor: ESTADOS_RECEPCION.PENDIENTE,
    etiqueta: "Pendiente",
    etiquetaPlural: "Pendientes por recibir",
    descripcion: "Aún no llega: suma al inventario cuando la marques como recibida.",
  },
];

const ESTILOS = {
  [ESTADOS_RECEPCION.RECIBIDA]: "bg-sky-100 text-sky-800 border-sky-200",
  [ESTADOS_RECEPCION.PENDIENTE]: "bg-amber-100 text-amber-800 border-amber-200",
};

export const getEtiquetaRecepcion = (estadoRecepcion) =>
  OPCIONES_RECEPCION.find((o) => o.valor === estadoRecepcion)?.etiqueta ??
  estadoRecepcion;

export const getEstiloRecepcion = (estadoRecepcion) =>
  ESTILOS[estadoRecepcion] ?? "bg-slate-100 text-slate-700 border-slate-200";

/** Solo una compra vigente y pendiente se puede marcar como recibida. */
export const puedeRecibirse = (compra) =>
  compra?.estado === "registrada" &&
  compra?.estado_recepcion === ESTADOS_RECEPCION.PENDIENTE;

/**
 * Fecha (YYYY-MM-DD) de un timestamp guardado. Las fechas de compra y
 * recepción se guardan como medianoche UTC del día elegido, así que se
 * toma la parte de fecha en UTC (mismo criterio que formatDate con
 * timeZone "UTC" en las páginas de compras).
 */
export const fechaIsoDe = (timestamp) =>
  timestamp ? new Date(timestamp).toISOString().split("T")[0] : "";

/** Hoy (YYYY-MM-DD) con el mismo criterio UTC que la fecha de la compra. */
export const hoyIso = () => fechaIsoDe(new Date());
