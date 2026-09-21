/**
 * Resumen de pagos de un pedido para el comprobante impreso.
 *
 * Neto por método (pagos - devoluciones) y saldo pendiente. Devuelve `null`
 * cuando no hay nada que agregar al comprobante: pedido pagado por completo
 * solo en efectivo, que es como se ha impreso siempre. Así los comprobantes
 * de las empresas que no usan métodos de pago ni abonos no cambian.
 *
 * `pedido.pagos` = [{ tipo, monto, metodo: { nombre, es_efectivo } }].
 */
export const resumirPagosParaTicket = (pedido) => {
  const netoPorMetodo = new Map();

  (pedido?.pagos || []).forEach((pago) => {
    const nombre = pago.metodo?.nombre || "Otro";
    const monto = Number(pago.monto) || 0;
    const delta = pago.tipo === "devolucion" ? -monto : monto;
    const previo = netoPorMetodo.get(nombre) || {
      nombre,
      esEfectivo: Boolean(pago.metodo?.es_efectivo),
      monto: 0,
    };
    previo.monto += delta;
    netoPorMetodo.set(nombre, previo);
  });

  const lineas = [...netoPorMetodo.values()].filter((l) => l.monto > 0);
  const pagado = lineas.reduce((acc, l) => acc + l.monto, 0);
  const saldo = Math.max((Number(pedido?.total) || 0) - pagado, 0);

  const soloEfectivo = lineas.every((l) => l.esEfectivo);
  if (saldo <= 0 && soloEfectivo) return null;

  return { lineas, pagado, saldo };
};
