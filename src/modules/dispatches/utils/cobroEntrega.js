/**
 * Reglas del cobro al entregar un pedido, del lado del cliente (feedback
 * inmediato: la fuente de verdad es el servidor, ver cobrar_saldo_pedido).
 */

// Lo que aún falta por pagar de un pedido: total - total_pagado.
export const calcularSaldo = (pedido) =>
  Math.max((Number(pedido?.total) || 0) - (Number(pedido?.total_pagado) || 0), 0);

// Los cobros se hacen en pesos enteros, pero un total puede llevar centavos
// (cantidad decimal × precio con IVA). Un saldo menor a un peso no se cobra:
// el servidor lo absorbe al entregar (ver cobrar_saldo_pedido).
const SALDO_MINIMO_COBRABLE = 1;

export const tieneSaldoPorCobrar = (pedido) =>
  calcularSaldo(pedido) >= SALDO_MINIMO_COBRABLE;

/**
 * ¿Marcar este pedido como entregado obliga a mostrar el diálogo de cobro?
 * Solo si queda saldo por cobrar y la empresa activó métodos de pago o
 * abonos. Con ambas opciones apagadas el pedido se entrega como siempre (el
 * servidor registra el cobro en efectivo sin preguntar).
 */
export const requiereCobroAlEntregar = (
  pedido,
  { metodosPagoActivo, abonosPedidosActivo },
) => tieneSaldoPorCobrar(pedido) && (metodosPagoActivo || abonosPedidosActivo);

/**
 * De los pedidos de un despacho (filas de despachos_pedidos con su `pedido`
 * embebido), los que siguen pendientes de entrega y aún tienen saldo: son los
 * que hay que cobrar al completar la ruta.
 */
export const pedidosPorCobrar = (items = []) =>
  items
    .filter(
      (item) => item.estado_entrega === "pendiente" && tieneSaldoPorCobrar(item.pedido),
    )
    .map((item) => item.pedido);
