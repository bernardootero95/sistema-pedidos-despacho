// src/modules/dispatches/utils/dispatchStatus.js

/**
 * Transiciones válidas para el estado general del despacho. Reflejo en
 * el frontend de la misma regla que valida el servidor en
 * actualizar_estado_despacho_transaccional (la fuente de verdad real);
 * esto solo evita ofrecer en la UI una transición que el servidor
 * rechazaría de todas formas.
 */
export const TRANSICIONES_VALIDAS_DESPACHO = {
  creado: ["en_ruta", "anulado"],
  en_ruta: ["completado", "anulado"],
  completado: [],
  anulado: [],
};

export const ETIQUETAS_TRANSICION_DESPACHO = {
  en_ruta: "Marcar en ruta",
  completado: "Marcar completado",
  anulado: "Anular despacho",
};

export const ESTILOS_ESTADO_DESPACHO = {
  creado: "bg-blue-100 text-blue-800 border-blue-200",
  en_ruta: "bg-amber-100 text-amber-800 border-amber-200",
  completado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  anulado: "bg-red-100 text-red-800 border-red-200",
};

export const ETIQUETAS_ESTADO_DESPACHO = {
  creado: "Creado",
  en_ruta: "En Ruta",
  completado: "Completado",
  anulado: "Anulado",
};

export const ETIQUETAS_ESTADO_ENTREGA = {
  pendiente: "Pendiente",
  entregado: "Entregado",
  rechazado: "Rechazado",
};
