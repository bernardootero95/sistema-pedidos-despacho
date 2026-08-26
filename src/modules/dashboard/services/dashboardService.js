import { supabase } from "../../../config/supabase";

export const dashboardService = {
  /**
   * KPIs agregados del dashboard (venta real vs preventa por día/mes,
   * conteos de pedidos por estado, despachos activos), calculados en el
   * servidor vía `obtener_resumen_dashboard`, respetando RLS por rol del
   * usuario autenticado.
   *
   * @param {string} [vendedorId] - Solo tiene efecto si quien llama es
   * gerencia/soporte (el propio RPC ignora el filtro para otros roles); un
   * vendedor/repartidor siempre ve su propio recorte vía RLS.
   */
  async obtenerResumen(vendedorId) {
    const { data, error } = await supabase.rpc("obtener_resumen_dashboard", {
      p_vendedor_id: vendedorId || null,
    });

    if (error) {
      throw new Error(`Error al obtener el resumen del dashboard: ${error.message}`);
    }

    return {
      totalPedidos: Number(data?.total_pedidos || 0),
      pedidosPendientes: Number(data?.pedidos_pendientes || 0),
      pedidosDespachados: Number(data?.pedidos_despachados || 0),
      pedidosEntregados: Number(data?.pedidos_entregados || 0),
      pedidosDevueltos: Number(data?.pedidos_devueltos || 0),
      ventaRealDia: Number(data?.venta_real_dia || 0),
      ventaRealMes: Number(data?.venta_real_mes || 0),
      preventaDia: Number(data?.preventa_dia || 0),
      preventaMes: Number(data?.preventa_mes || 0),
      despachosActivos: Number(data?.despachos_activos || 0),
    };
  },

  /**
   * Últimos pedidos registrados para la tabla de monitoreo del dashboard.
   * Sin paginación: es una vista previa acotada, no el listado completo
   * (para eso está /pedidos).
   *
   * @param {number} [limit]
   * @param {string} [vendedorId] - Recorte adicional por vendedor; solo lo
   * usa el frontend cuando quien filtra es gerencia/soporte (esas RLS ya
   * permiten leer cualquier pedido, así que no hace falta pasar por RPC).
   */
  async obtenerUltimosPedidos(limit = 3, vendedorId) {
    let query = supabase
      .from("pedidos_cabecera")
      .select(
        `
        id,
        numero_pedido,
        total,
        estado,
        fecha_pedido,
        clientes ( razon_social, primer_nombre, primer_apellido ),
        vendedor:perfiles ( nombre_completo )
      `,
      )
      .is("eliminado", null)
      .order("fecha_pedido", { ascending: false })
      .limit(limit);

    if (vendedorId) query = query.eq("vendedor_id", vendedorId);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener los últimos pedidos: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Serie de ventas diarias (últimos 30 días) para el gráfico del
   * dashboard, separada en venta real (entregado) y preventa (pendiente +
   * despachado), calculada en el servidor vía `obtener_ventas_diarias`.
   * No es SECURITY DEFINER: respeta la misma RLS por rol que el resto de
   * `pedidos_cabecera` (un vendedor ve su propia curva, no la de todos).
   *
   * @param {string} [vendedorId]
   */
  async obtenerVentasDiarias(vendedorId) {
    const { data, error } = await supabase.rpc("obtener_ventas_diarias", {
      p_vendedor_id: vendedorId || null,
    });

    if (error) {
      throw new Error(`Error al obtener las ventas diarias: ${error.message}`);
    }

    return (data || []).map((punto) => ({
      fecha: punto.fecha,
      ventaReal: Number(punto.venta_real || 0),
      preventa: Number(punto.preventa || 0),
    }));
  },
};
