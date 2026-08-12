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
          clientes(razon_social, primer_nombre, primer_apellido)
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
   * Actualiza el estado general del despacho (ej: 'en_ruta', 'completado')
   */
  async actualizarEstadoDespacho(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("despachos")
      .update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
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
