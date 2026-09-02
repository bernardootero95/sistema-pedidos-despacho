// src/modules/orders/utils/orderConstants.js

/**
 * Estados posibles de un pedido y columnas de fecha filtrables, compartidos
 * entre OrdersPage y el informe de productos (reports/pages/ProductsReportPage)
 * para no duplicar estos arrays en cada lugar que arma un select de filtro.
 */
export const ESTADOS_PEDIDO = ["pendiente", "en_ruta", "entregado", "anulado"];

export const CAMPOS_FECHA = [
  { value: "fecha_pedido", label: "Fecha de pedido" },
  { value: "fecha_entrega", label: "Fecha de entrega" },
];
