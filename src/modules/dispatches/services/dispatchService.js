import { supabase } from "../../../config/supabase";

export const dispatchService = {
  /**
   * Obtiene la lista de despachos con paginación y búsqueda
   * Incluye los datos relacionales del vehículo y del repartidor
   */
  async getDespachosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("despachos")
      .select(
        `
        *,
        vehiculo:vehiculos(placa, marca),
        repartidor:perfiles(nombre_completo)
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("fecha_despacho", { ascending: false });

    if (searchTerm) {
      query = query.ilike("codigo_despacho", `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw new Error(`Error al obtener despachos: ${error.message}`);
    }

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Crea un despacho de forma atómica mediante la función RPC
   * `crear_despacho_transaccional`: bloquea el vehículo y los pedidos
   * seleccionados, valida que el vehículo no tenga ya un despacho activo
   * y que los pedidos sigan 'pendiente' (evita doble asignación
   * concurrente por dos despachadores), genera el consecutivo y marca los
   * pedidos como 'despachado' — todo dentro de una única transacción.
   *
   * @param {Object} cabeceraData - { vehiculo_id, repartidor_id, fecha_despacho, notas }
   * @param {string[]} pedidosIds
   */
  async crearDespachoTransaccional(cabeceraData, pedidosIds) {
    const { data, error } = await supabase.rpc("crear_despacho_transaccional", {
      p_vehiculo_id: cabeceraData.vehiculo_id,
      p_repartidor_id: cabeceraData.repartidor_id,
      p_fecha_despacho: cabeceraData.fecha_despacho,
      p_notas: cabeceraData.notas || null,
      p_pedidos_ids: pedidosIds,
    });

    if (error) {
      throw new Error(error.message || "Error al crear el despacho.");
    }

    return data;
  },

  /**
   * Obtiene la cabecera completa de un despacho (vehículo, repartidor,
   * estado, fecha, notas) para la página de detalle.
   */
  async getDespachoCompleto(id) {
    const { data, error } = await supabase
      .from("despachos")
      .select(
        `
        *,
        vehiculo:vehiculos(placa, marca, modelo),
        repartidor:perfiles(nombre_completo, nombre_usuario)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(`Error al obtener el despacho: ${error.message}`);
    }

    return data;
  },

  /**
   * Obtiene los detalles de un despacho específico (qué pedidos tiene adentro)
   */
  async obtenerDetallesDespacho(despachoId) {
    const { data, error } = await supabase
      .from("despachos_pedidos")
      .select(
        `
        *,
        pedido:pedidos_cabecera(
          id,
          numero_pedido,
          total,
          clientes(razon_social, primer_nombre, primer_apellido, direccion, telefono)
        )
      `,
      )
      .eq("despacho_id", despachoId);

    if (error) {
      throw new Error(
        `Error al obtener los detalles del despacho: ${error.message}`,
      );
    }

    return data;
  },

  /**
   * Despacho activo del repartidor autenticado (el más reciente en curso,
   * estado 'creado' o 'en_ruta') con sus pedidos asignados, para la vista
   * simplificada de "mi ruta de hoy". RLS ya restringe despachos/pedidos al
   * propio repartidor_id, pero se filtra explícito para que el contrato
   * del método sea claro sin depender solo de RLS para leerlo.
   *
   * @returns {Promise<{despacho: Object, pedidos: Array}|null>} null si no
   * tiene ninguna ruta activa en este momento.
   */
  async obtenerRutaActivaRepartidor(repartidorId) {
    const { data: despacho, error: despachoError } = await supabase
      .from("despachos")
      .select(
        `
        id,
        codigo_despacho,
        estado,
        fecha_despacho,
        notas,
        vehiculo:vehiculos(placa, marca, modelo)
      `,
      )
      .eq("repartidor_id", repartidorId)
      .in("estado", ["creado", "en_ruta"])
      .is("eliminado", null)
      .order("fecha_despacho", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (despachoError) {
      throw new Error(
        `Error al obtener tu ruta activa: ${despachoError.message}`,
      );
    }
    if (!despacho) return null;

    const pedidos = await this.obtenerDetallesDespacho(despacho.id);
    return { despacho, pedidos };
  },

  /**
   * Cambia el estado general del despacho (ej: 'en_ruta', 'completado',
   * 'anulado') de forma atómica mediante la función RPC
   * `actualizar_estado_despacho_transaccional`. La validación de qué
   * transiciones son válidas vive en el servidor, no solo en el
   * frontend. Al completar el despacho, cascada automáticamente los
   * pedidos pendientes de entrega a 'entregado'; al anular, libera los
   * pedidos aún no entregados de vuelta a 'pendiente' para poder
   * reasignarlos.
   */
  async actualizarEstadoDespachoTransaccional(id, nuevoEstado) {
    const { data, error } = await supabase.rpc(
      "actualizar_estado_despacho_transaccional",
      { p_despacho_id: id, p_nuevo_estado: nuevoEstado },
    );

    if (error) {
      throw new Error(error.message || "No se pudo actualizar el estado.");
    }

    return data;
  },

  /**
   * Corrige el estado de entrega de un pedido puntual dentro de la ruta
   * (por ejemplo, si fue devuelto o ya se entregó antes de cerrar todo el
   * despacho), sincronizando pedidos_cabecera.estado en la misma
   * transacción vía `actualizar_estado_entrega_pedido_transaccional`.
   *
   * @param {string} despachoPedidoId - id de la fila en despachos_pedidos
   * @param {'pendiente'|'entregado'|'rechazado'} nuevoEstadoEntrega
   * @param {string} [notas]
   */
  async actualizarEstadoEntregaPedido(
    despachoPedidoId,
    nuevoEstadoEntrega,
    notas = null,
  ) {
    const { data, error } = await supabase.rpc(
      "actualizar_estado_entrega_pedido_transaccional",
      {
        p_despacho_pedido_id: despachoPedidoId,
        p_nuevo_estado_entrega: nuevoEstadoEntrega,
        p_notas_entrega: notas,
      },
    );

    if (error) {
      throw new Error(
        error.message || "No se pudo actualizar la entrega del pedido.",
      );
    }

    return data;
  },

  /**
   * Borrado lógico (Soft Delete) del despacho
   */
  async eliminarDespacho(id) {
    const { error } = await supabase
      .from("despachos")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(error.message);
    return true;
  },
};
