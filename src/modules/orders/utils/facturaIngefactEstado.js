// Mismo plazo que iniciar_operacion_ingefact: pasado este tiempo una
// operación en curso se considera abandonada y soporte/gerencia puede reintentarla.
export const MINUTOS_OPERACION_ABANDONADA = 10;

/**
 * Resume las columnas ingefact_* de un pedido en qué mostrar y qué acción
 * manual ofrecer. Replica las reglas de iniciar_operacion_ingefact solo
 * para decidir qué botón pintar: la fuente de verdad es el servidor, que
 * igual rechaza una acción que ya no aplique.
 *
 * @param {Object} pedido
 * @param {number} [ahora] epoch ms, inyectable para pruebas
 * @returns {{ aviso: "en_curso"|"vigente"|"anulada"|"error"|"limite"|null, accion: "facturar"|"anular"|null }}
 */
export function getEstadoFacturaIngefact(pedido, ahora = Date.now()) {
  const facturaVigente = !!pedido.ingefact_factura_id && !pedido.ingefact_anulado_en;
  const entregado = pedido.estado === "entregado";

  if (pedido.ingefact_en_curso_desde) {
    const abandonada =
      ahora - new Date(pedido.ingefact_en_curso_desde).getTime() >
      MINUTOS_OPERACION_ABANDONADA * 60 * 1000;
    const accionEnCurso = pedido.ingefact_estado === "anulando" ? "anular" : "facturar";
    return { aviso: "en_curso", accion: abandonada ? accionEnCurso : null };
  }

  if (facturaVigente) {
    if (pedido.ingefact_estado === "error_anulacion" && !entregado) {
      return { aviso: "error", accion: "anular" };
    }
    return { aviso: "vigente", accion: null };
  }

  // "limite": la emisión automática se saltó este pedido por el límite de
  // facturación; solo es relevante mientras siga entregado y se puede emitir
  // a mano (el botón manual no tiene límite).
  const aviso =
    pedido.ingefact_estado === "error_facturacion"
      ? "error"
      : pedido.ingefact_estado === "limite_alcanzado" && entregado
        ? "limite"
        : pedido.ingefact_anulado_en
          ? "anulada"
          : null;

  return { aviso, accion: entregado ? "facturar" : null };
}
