// src/modules/reports/services/reportService.js
import { supabase } from "../../../config/supabase";
import { normalizarResumenVentas } from "../utils/salesReportFormat";

export const reportService = {
  /**
   * Informe agregado por producto (cantidad y valor total movido) para un
   * rango de fechas, con filtros opcionales de estado/vendedor/cliente.
   * Va por RPC (obtener_informe_productos_pedidos, SECURITY DEFINER) y no
   * por query directa porque cruza pedidos de todos los vendedores — el
   * propio RPC valida que quien llama sea soporte/gerencia.
   *
   * @param {{ fechaDesde: string, fechaHasta: string, campoFecha?: string, estado?: string, vendedorId?: string, clienteId?: string }} filtros
   */
  async obtenerInformeProductos(filtros) {
    const { fechaDesde, fechaHasta, campoFecha, estado, vendedorId, clienteId } = filtros;

    const { data, error } = await supabase.rpc("obtener_informe_productos_pedidos", {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
      p_campo_fecha: campoFecha || "fecha_entrega",
      p_estado: estado || null,
      p_vendedor_id: vendedorId || null,
      p_cliente_id: clienteId || null,
    });

    if (error) {
      // Postgres RAISE EXCEPTION (rango de fechas inválido, sin permiso) llega acá como error.message
      throw new Error(error.message || "Error al generar el informe.");
    }

    // cantidad_total/monto_total son NUMERIC: PostgREST los serializa como
    // string para no perder precisión (mismo caso que pedidos_detalle.cantidad
    // en orderService.getPedidoCompleto). Se normalizan acá, no en cada
    // consumidor (tabla, PDF, Excel).
    return (data || []).map((fila) => ({
      ...fila,
      cantidad_total: Number(fila.cantidad_total),
      monto_total: Number(fila.monto_total),
      pedidos_count: Number(fila.pedidos_count),
    }));
  },

  /**
   * Informe de ventas de un período (día o mes): preventa por fecha de
   * pedido, venta real por fecha de entrega, anulados/devueltos y
   * pendientes del período vs. arrastrados de períodos anteriores. Todo el
   * cálculo (incluido el corte de días en la zona horaria del negocio) vive
   * en el RPC obtener_informe_ventas; acá solo se normalizan tipos.
   *
   * @param {{ fechaDesde: string, fechaHasta: string, vendedorId?: string }} filtros
   * @returns {Promise<{ resumen: Record<string, {cantidad: number, monto: number}>, detalle: Array<Object> }>}
   */
  async obtenerInformeVentas({ fechaDesde, fechaHasta, vendedorId }) {
    const { data, error } = await supabase.rpc("obtener_informe_ventas", {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
      p_vendedor_id: vendedorId || null,
    });

    if (error) {
      throw new Error(error.message || "Error al generar el informe de ventas.");
    }

    const resumen = normalizarResumenVentas(data?.resumen);

    const detalle = (data?.detalle || []).map((pedido) => ({
      ...pedido,
      total: Number(pedido.total) || 0,
    }));

    return { resumen, detalle };
  },
};
