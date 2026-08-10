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

    // Búsqueda por código de despacho
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
   * Crea un nuevo despacho (Cabecera) y le asigna los pedidos (Detalle)
   */
  async crearDespacho(despachoData, pedidosIds) {
    // 1. Insertar la Cabecera del Despacho
    const { data: cabecera, error: errorCabecera } = await supabase
      .from("despachos")
      .insert([despachoData])
      .select()
      .single();

    if (errorCabecera) {
      throw new Error(`Error al crear el despacho: ${errorCabecera.message}`);
    }

    // 2. Insertar los Detalles (Relacionar pedidos al despacho)
    if (pedidosIds && pedidosIds.length > 0) {
      const detalles = pedidosIds.map((pedidoId) => ({
        despacho_id: cabecera.id,
        pedido_id: pedidoId,
        estado_entrega: "pendiente",
      }));

      const { error: errorDetalle } = await supabase
        .from("despachos_pedidos")
        .insert(detalles);

      // Si falla el detalle, hacemos un rollback manual eliminando la cabecera huérfana
      if (errorDetalle) {
        await supabase.from("despachos").delete().eq("id", cabecera.id);
        throw new Error(
          `Error al asignar los pedidos al despacho: ${errorDetalle.message}`,
        );
      }
    }

    return cabecera;
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
          consecutivo, 
          total,
          cliente:clientes(razon_social, primer_nombre, primer_apellido)
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
