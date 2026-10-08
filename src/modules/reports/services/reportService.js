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

  /**
   * Informe de utilidad bruta de un período: ventas entregadas (por fecha
   * de entrega) menos el costo de lo vendido, con el costo capturado en
   * cada línea del pedido al momento de registrarla. Todo el cálculo vive
   * en el RPC obtener_informe_utilidad; acá solo se normalizan tipos.
   *
   * @param {{ fechaDesde: string, fechaHasta: string }} filtros
   */
  async obtenerInformeUtilidad({ fechaDesde, fechaHasta }) {
    const { data, error } = await supabase.rpc("obtener_informe_utilidad", {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    });

    if (error) {
      throw new Error(error.message || "Error al generar el informe de utilidad.");
    }

    const r = data?.resumen || {};
    const resumen = {
      ventas: Number(r.ventas) || 0,
      ventasConCosto: Number(r.ventas_con_costo) || 0,
      costo: Number(r.costo) || 0,
      utilidad: Number(r.utilidad) || 0,
      pedidos: Number(r.pedidos) || 0,
      sinCosto: {
        monto: Number(r.sin_costo?.monto) || 0,
        productos: Number(r.sin_costo?.productos) || 0,
      },
    };

    const detalle = (data?.detalle || []).map((fila) => ({
      productoId: fila.producto_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      cantidad: Number(fila.cantidad) || 0,
      ventas: Number(fila.ventas) || 0,
      ventasConCosto: Number(fila.ventas_con_costo) || 0,
      costo: Number(fila.costo) || 0,
      utilidad: Number(fila.utilidad) || 0,
      ventasSinCosto: Number(fila.ventas_sin_costo) || 0,
      pedidos: Number(fila.pedidos) || 0,
    }));

    return { resumen, detalle };
  },

  /**
   * Informe de inventario de un rango: inicial, compras, ventas (entregados),
   * ajustes de toma física, preventa (pedidos por entregar) y disponible por
   * producto. La reconstrucción hacia atrás vive en el RPC
   * obtener_informe_inventario; acá solo se normalizan tipos.
   *
   * @param {{ fechaDesde: string, fechaHasta: string }} filtros
   */
  async obtenerInformeInventario({ fechaDesde, fechaHasta }) {
    const { data, error } = await supabase.rpc("obtener_informe_inventario", {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    });

    if (error) {
      throw new Error(error.message || "Error al generar el informe de inventario.");
    }

    return (data || []).map((fila) => ({
      productoId: fila.producto_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      inicial: Number(fila.inicial) || 0,
      compras: Number(fila.compras) || 0,
      ventas: Number(fila.ventas) || 0,
      ajustes: Number(fila.ajustes) || 0,
      fisicoFinal: Number(fila.fisico_final) || 0,
      preventa: Number(fila.preventa) || 0,
      disponible: Number(fila.disponible) || 0,
      costoUnitario: fila.costo_unitario == null ? null : Number(fila.costo_unitario),
      precioVenta: Number(fila.precio_venta) || 0,
    }));
  },

  /**
   * Inventario real de la bodega hoy: disponible + pendiente por entregar,
   * con lo necesario para valorarlo a costo y a venta. Lo calcula el RPC
   * obtener_inventario_actual.
   */
  async obtenerInventarioActual() {
    const { data, error } = await supabase.rpc("obtener_inventario_actual");

    if (error) {
      throw new Error(error.message || "Error al generar el informe de inventario actual.");
    }

    return (data || []).map((fila) => ({
      productoId: fila.producto_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      disponible: Number(fila.disponible) || 0,
      pendiente: Number(fila.pendiente) || 0,
      ventaPendiente: Number(fila.venta_pendiente) || 0,
      costoUnitario: fila.costo_unitario == null ? null : Number(fila.costo_unitario),
      precioVenta: Number(fila.precio_venta) || 0,
    }));
  },
};
