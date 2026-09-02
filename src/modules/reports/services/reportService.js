// src/modules/reports/services/reportService.js
import { supabase } from "../../../config/supabase";

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
};
