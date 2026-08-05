// src/modules/orders/services/orderService.js
import { supabase } from "../../../config/supabase";

export const orderService = {
  /**
   * Obtiene la lista de pedidos (cabecera) con paginación
   */
  async getPedidosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

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
   * Crea un nuevo pedido integrando Cabecera y Detalle con validación estricta de stock
   */
  async crearPedido(pedidoData, detallesData) {
    // 1. Verificación de stock en tiempo real antes de tocar la BD
    for (const item of detallesData) {
      const { data: productoActual, error: errorProd } = await supabase
        .from("productos")
        .select("nombre, disponible")
        .eq("id", item.producto_id)
        .single();

      if (errorProd)
        throw new Error(`No se pudo verificar el stock del producto.`);

      if (productoActual.disponible < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${productoActual.nombre}". Cantidad disponible: ${productoActual.disponible}, solicitada: ${item.cantidad}.`,
        );
      }
    }

    // 2. Insertamos primero la Cabecera del pedido
    const { data: cabecera, error: errorCabecera } = await supabase
      .from("pedidos_cabecera")
      .insert([pedidoData])
      .select()
      .single();

    if (errorCabecera) throw errorCabecera;

    // 3. Preparamos los detalles inyectándoles el ID de la cabecera
    const detallesConId = detallesData.map((detalle) => ({
      ...detalle,
      pedido_id: cabecera.id,
    }));

    // 4. Insertamos todos los detalles en bloque
    const { error: errorDetalles } = await supabase
      .from("pedidos_detalle")
      .insert(detallesConId);

    if (errorDetalles) throw errorDetalles;

    // Opcional: Aquí posteriormente podemos descontar el inventario de la tabla productos de forma automática

    return cabecera;
  },

  /**
   * Obtiene la ficha completa de un pedido específico
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
   * Anula un pedido
   */
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
