/**
 * Reglas del cobro al entregar un pedido, del lado del cliente (feedback
 * inmediato: la fuente de verdad es el servidor, ver cobrar_saldo_pedido).
 */

// Lo que aún falta por pagar de un pedido: total - total_pagado.
export const calcularSaldo = (pedido) =>
  Math.max((Number(pedido?.total) || 0) - (Number(pedido?.total_pagado) || 0), 0);

/**
 * ¿Marcar este pedido como entregado obliga a mostrar el diálogo de cobro?
 * Solo si queda saldo y la empresa activó métodos de pago o abonos. Con ambas
 * opciones apagadas el pedido se entrega como siempre (el servidor registra
 * el cobro en efectivo sin preguntar).
 */
export const requiereCobroAlEntregar = (
  pedido,
  { metodosPagoActivo, abonosPedidosActivo },
) => calcularSaldo(pedido) > 0 && (metodosPagoActivo || abonosPedidosActivo);

/**
 * Tras entregar, el pedido queda pagado por completo (el servidor lo exige):
 * se refleja en la copia local sin volver a consultar.
 */
export const marcarPedidoPagado = (pedido) =>
  pedido ? { ...pedido, total_pagado: pedido.total } : pedido;

/**
 * De los pedidos de un despacho (filas de despachos_pedidos con su `pedido`
 * embebido), los que siguen pendientes de entrega y aún tienen saldo: son los
 * que hay que cobrar al completar la ruta.
 */
export const pedidosPorCobrar = (items = []) =>
  items
    .filter(
      (item) => item.estado_entrega === "pendiente" && calcularSaldo(item.pedido) > 0,
    )
    .map((item) => item.pedido);
