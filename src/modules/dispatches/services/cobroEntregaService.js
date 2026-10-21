import { supabase } from "../../../config/supabase";
import { requiereCobroAlEntregar } from "../utils/cobroEntrega";

/**
 * Antes de abrir el diálogo de cobro se confirma el saldo contra el servidor:
 * el pedido que muestra la pantalla puede estar viejo (un abono registrado
 * desde otro lado no siempre dispara una recarga) y cobrar con un saldo
 * desactualizado termina en "el pedido ya está pagado por completo".
 */
export const cobroEntregaService = {
  /**
   * Devuelve el pedido con su total y total_pagado vigentes si todavía hay
   * saldo por cobrar al entregarlo, o null si ya no hay nada que cobrar. Si no
   * se puede consultar, se confía en los datos de la pantalla y el servidor
   * sigue siendo quien decide al entregar.
   */
  async pedidoPorCobrar(pedido, configuracion) {
    if (!requiereCobroAlEntregar(pedido, configuracion)) return null;

    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .select("total, total_pagado")
      .eq("id", pedido.id)
      .maybeSingle();

    if (error || !data) return pedido;

    const vigente = { ...pedido, ...data };
    return requiereCobroAlEntregar(vigente, configuracion) ? vigente : null;
  },
};
