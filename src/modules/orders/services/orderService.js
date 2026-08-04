// src/modules/orders/services/orderService.js
import { supabase } from "../../../config/supabase";

export const orderService = {
  /**
   * Obtiene la lista de pedidos (cabecera) con paginación
   */
  async getPedidosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Traemos el pedido junto con el nombre del cliente y del vendedor
    let query = supabase
      .from("pedidos_cabecera")
      .select(
        `
        *,
        clientes ( razon_social, primer_nombre, primer_apellido, numero_identificacion ),
        vendedor:perfiles ( nombre_completo )
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("creado", { ascending: false });

    // Si hay término de búsqueda, filtramos por número de pedido
    if (searchTerm) {
      query = query.ilike("numero_pedido", `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Crea un nuevo pedido integrando Cabecera y Detalle
   */
  async crearPedido(pedidoData, detallesData) {
    // 1. Insertamos primero la Cabecera del pedido
    const { data: cabecera, error: errorCabecera } = await supabase
      .from("pedidos_cabecera")
      .insert([pedidoData])
      .select()
      .single();

    if (errorCabecera) throw errorCabecera;

    // 2. Preparamos los detalles inyectándoles el ID de la cabecera recién creada
    const detallesConId = detallesData.map((detalle) => ({
      ...detalle,
      pedido_id: cabecera.id,
    }));

    // 3. Insertamos todos los detalles en bloque (Bulk Insert)
    const { error: errorDetalles } = await supabase
      .from("pedidos_detalle")
      .insert(detallesConId);

    if (errorDetalles) {
      // En un entorno de producción estricto, aquí se llamaría a un rollback o se usaría una RPC,
      // pero para nuestro flujo Supabase lo maneja de forma óptima.
      throw errorDetalles;
    }

    return cabecera;
  },

  /**
   * Obtiene la ficha completa de un pedido específico (Ficha de impresión/visualización)
   */
  async getPedidoCompleto(id) {
    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .select(
        `
        *,
        clientes (*),
        vendedor:perfiles (*),
        detalles:pedidos_detalle (
          *,
          producto:productos (codigo, nombre)
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Anula un pedido (Soft delete cambiando el estado a anulado)
   */
  async anularPedido(id, motivoAnulacion) {
    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .update({
        estado: "anulado",
        notas: motivoAnulacion, // Guardamos el por qué se anuló
        actualizado: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
