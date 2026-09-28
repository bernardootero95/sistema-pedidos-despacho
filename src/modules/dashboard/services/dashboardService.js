import { supabase } from "../../../config/supabase";
import { normalizarResumenVentas } from "../../reports/utils/salesReportFormat";

export const dashboardService = {
  /**
   * KPIs del dashboard calculados en el servidor vía
   * `obtener_resumen_dashboard`, respetando RLS por rol: resumen de hoy y
   * del mes con los mismos conceptos del informe de ventas (preventa,
   * ventas, anulados/devueltos, pendientes del período y anteriores) más
   * la foto operativa (pendientes por despachar, en ruta, rutas activas).
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
      hoy: normalizarResumenVentas(data?.hoy),
      mes: normalizarResumenVentas(data?.mes),
      pedidosPendientes: Number(data?.pedidos_pendientes || 0),
      pedidosDespachados: Number(data?.pedidos_despachados || 0),
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
   * Serie diaria (últimos 30 días) para el gráfico del dashboard: ventas
   * (entregados, por fecha de entrega) y preventa (todos los pedidos, por
   * fecha del pedido), calculada en el servidor vía `obtener_ventas_diarias`.
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
