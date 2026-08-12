// src/modules/orders/services/orderService.js
import { supabase } from "../../../config/supabase";

export const orderService = {
  async getPedidosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("pedidos_cabecera")
      .select(
        `
        *,
        clientes ( razon_social, primer_nombre, primer_apellido, numero_identificacion, direccion, tipo_identificacion ),
        vendedor:perfiles ( nombre_completo )
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (searchTerm) {
      query = query.ilike("numero_pedido", `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return { data, total: count, totalPages: Math.ceil(count / limit) };
  },

  /**
   * Crea un pedido de forma atómica mediante la función RPC
   * `crear_pedido_transaccional`. Toda la validación de stock, el cálculo
   * de precios y el consecutivo se resuelven en el servidor dentro de una
   * única transacción, evitando condiciones de carrera entre vendedores
   * concurrentes y evitando confiar en precios enviados por el cliente.
   *
   * @param {Object} cabeceraData - { cliente_id, vendedor_id, notas }
   * @param {Array} detallesData - [{ producto_id, cantidad }, ...]
   */
  async crearPedido(cabeceraData, detallesData) {
    const detallesParaRpc = detallesData.map((item) => ({
      producto_id: item.producto_id,
      cantidad: Number(item.cantidad),
    }));

    const { data, error } = await supabase.rpc("crear_pedido_transaccional", {
      p_cliente_id: cabeceraData.cliente_id,
      p_vendedor_id: cabeceraData.vendedor_id,
      p_notas: cabeceraData.notas || null,
      p_detalles: detallesParaRpc,
    });

    if (error) {
      // Postgres RAISE EXCEPTION llega aquí como error.message
      throw new Error(error.message || "Error al crear el pedido.");
    }

    return data;
  },

  /**
   * Obtiene los pedidos en estado 'pendiente' disponibles para asignar a
   * una orden de despacho. Sin paginación a propósito: el despachador
   * necesita ver el universo completo de pendientes para armar la ruta,
   * no una porción de 10 en 10.
   */
  async getPedidosPendientes() {
    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .select(
        `
        id,
        numero_pedido,
        total,
        clientes ( razon_social, primer_nombre, primer_apellido )
      `,
      )
      .eq("estado", "pendiente")
      .is("eliminado", null)
      .order("creado", { ascending: true }); // FIFO: los más antiguos primero

    if (error) {
      throw new Error(`Error al obtener pedidos pendientes: ${error.message}`);
    }

    return data || [];
  },

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

  async anularPedido(id, motivoAnulacion) {
    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .update({
        estado: "anulado",
        notas: motivoAnulacion,
        actualizado: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
