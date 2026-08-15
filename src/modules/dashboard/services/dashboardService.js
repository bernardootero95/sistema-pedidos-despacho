import { supabase } from "../../../config/supabase";

export const dashboardService = {
  /**
   * KPIs agregados (ventas totales, pedidos, pendientes, despachos activos)
   * calculados en el servidor vía `obtener_resumen_dashboard`, respetando
   * RLS por rol del usuario autenticado.
   */
  async obtenerResumen() {
    const { data, error } = await supabase.rpc("obtener_resumen_dashboard");

    if (error) {
      throw new Error(`Error al obtener el resumen del dashboard: ${error.message}`);
    }

    return {
      ventasTotales: Number(data?.ventas_totales || 0),
      totalPedidos: Number(data?.total_pedidos || 0),
      pedidosPendientes: Number(data?.pedidos_pendientes || 0),
      despachosActivos: Number(data?.despachos_activos || 0),
    };
  },

  /**
   * Últimos pedidos registrados para la tabla de monitoreo del dashboard.
   * Sin paginación: es una vista previa acotada, no el listado completo
   * (para eso está /pedidos).
   */
  async obtenerUltimosPedidos(limit = 8) {
    const { data, error } = await supabase
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

    if (error) {
      throw new Error(`Error al obtener los últimos pedidos: ${error.message}`);
    }

    return data || [];
  },
};
