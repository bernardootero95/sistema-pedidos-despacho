import { supabase } from "../../../config/supabase";

const COLUMNAS_PAGO = `
  id, tipo, monto, creado,
  metodo:metodos_pago ( nombre ),
  registrador:perfiles ( nombre_completo )
`;

const registrarAbono = async (rpc, params, mensajeError) => {
  const { data, error } = await supabase.rpc(rpc, params);
  if (error) throw new Error(error.message || mensajeError);
  return data;
};

export const paymentService = {
  /**
   * Movimientos de dinero (pagos, abonos, devoluciones) de un pedido, del más
   * antiguo al más reciente. La RLS de `pagos` ya limita a los pedidos que el
   * usuario puede ver.
   */
  async getPagosPedido(pedidoId) {
    const { data, error } = await supabase
      .from("pagos")
      .select(COLUMNAS_PAGO)
      .eq("pedido_id", pedidoId)
      .order("creado", { ascending: true });

    if (error)
      throw new Error("Error al obtener los pagos del pedido: " + error.message);
    return data || [];
  },

  async getPagosCompra(compraId) {
    const { data, error } = await supabase
      .from("pagos")
      .select(COLUMNAS_PAGO)
      .eq("compra_id", compraId)
      .order("creado", { ascending: true });

    if (error)
      throw new Error("Error al obtener los pagos de la compra: " + error.message);
    return data || [];
  },

  /**
   * Abono a un pedido pendiente/despachado vía `registrar_abono_pedido`
   * (solo soporte/gerencia, y solo con la opción de abonos activada).
   *
   * @param {string} pedidoId
   * @param {Array<{metodo_pago_id: string|null, monto: number}>} pagos
   */
  registrarAbonoPedido(pedidoId, pagos) {
    return registrarAbono(
      "registrar_abono_pedido",
      { p_pedido_id: pedidoId, p_pagos: pagos },
      "No se pudo registrar el abono.",
    );
  },

  registrarAbonoCompra(compraId, pagos) {
    return registrarAbono(
      "registrar_abono_compra",
      { p_compra_id: compraId, p_pagos: pagos },
      "No se pudo registrar el abono.",
    );
  },
};
