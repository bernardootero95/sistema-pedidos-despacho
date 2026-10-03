// src/modules/orders/utils/orderConstants.js

/**
 * Estados posibles de un pedido (`pedidos_cabecera.estado`) y columnas de
 * fecha filtrables, compartidos entre OrdersPage, OrderDetailsPage y el
 * informe de productos (reports/pages/ProductsReportPage) para no duplicar
 * estos valores en cada select de filtro o badge.
 *
 * Reflejo de lo que escriben los RPC del servidor (la columna no tiene
 * CHECK): crear_pedido → 'pendiente', crear despacho → 'despachado',
 * entrega → 'entregado' / rechazo → 'devuelto', anular → 'anulado'.
 * Ojo: 'en_ruta' es un estado de `despachos`, no de pedidos.
 */
export const ESTADOS_PEDIDO = ["pendiente", "despachado", "entregado", "devuelto", "anulado"];

export const ETIQUETAS_ESTADO_PEDIDO = {
  pendiente: "Pendiente",
  despachado: "Despachado",
  entregado: "Entregado",
  devuelto: "Devuelto",
  anulado: "Anulado",
};

export const ESTILOS_ESTADO_PEDIDO = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  despachado: "bg-blue-100 text-blue-800 border-blue-200",
  entregado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  devuelto: "bg-orange-100 text-orange-800 border-orange-200",
  anulado: "bg-red-100 text-red-800 border-red-200",
};

const ESTILO_ESTADO_DESCONOCIDO = "bg-slate-100 text-slate-800 border-slate-200";

/** Etiqueta legible del estado; si llega uno desconocido se muestra tal cual. */
export const getEtiquetaEstadoPedido = (estado) =>
  ETIQUETAS_ESTADO_PEDIDO[estado?.toLowerCase()] || estado || "";

/** Clases de color del badge del estado, con un gris neutro por defecto. */
export const getEstiloEstadoPedido = (estado) =>
  ESTILOS_ESTADO_PEDIDO[estado?.toLowerCase()] || ESTILO_ESTADO_DESCONOCIDO;

export const CAMPOS_FECHA = [
  { value: "fecha_pedido", label: "Fecha de pedido" },
  { value: "fecha_entrega", label: "Fecha de entrega" },
];
