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
   * Genera el siguiente número consecutivo de pedido (Ej: 1, 2, 3...)
   */
  async obtenerSiguienteNumeroPedido() {
    const { data, error } = await supabase
      .from("pedidos_cabecera")
      .select("numero_pedido")
      .order("creado", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return "1"; // Primer pedido del sistema
    }

    const ultimoNumero = parseInt(data[0].numero_pedido, 10);
    if (isNaN(ultimoNumero)) {
      return "1";
    }

    return (ultimoNumero + 1).toString();
  },

  async crearPedido(pedidoData, detallesData) {
    // 1. Validar y descontar stock
    for (const item of detallesData) {
      const { data: productoActual, error: errorProd } = await supabase
        .from("productos")
        .select("nombre, disponible")
        .eq("id", item.producto_id)
        .single();

      if (errorProd)
        throw new Error("No se pudo verificar el stock del producto.");

      if (productoActual.disponible < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${productoActual.nombre}". Disponible: ${productoActual.disponible}`,
        );
      }
    }

    // 2. Asignar el consecutivo numérico automático
    const siguienteNumero = await this.obtenerSiguienteNumeroPedido();
    const pedidoConConsecutivo = {
      ...pedidoData,
      numero_pedido: siguienteNumero,
    };

    // 3. Insertar Cabecera
    const { data: cabecera, error: errorCabecera } = await supabase
      .from("pedidos_cabecera")
      .insert([pedidoConConsecutivo])
      .select()
      .single();

    if (errorCabecera) throw errorCabecera;

    // 4. Insertar Detalles
    const detallesConId = detallesData.map((detalle) => ({
      ...detalle,
      pedido_id: cabecera.id,
    }));

    const { error: errorDetalles } = await supabase
      .from("pedidos_detalle")
      .insert(detallesConId);

    if (errorDetalles) throw errorDetalles;

    // 5. Descontar Inventario
    for (const item of detallesData) {
      const { data: prod } = await supabase
        .from("productos")
        .select("disponible")
        .eq("id", item.producto_id)
        .single();

      const nuevoStock = prod.disponible - item.cantidad;
      await supabase
        .from("productos")
        .update({
          disponible: nuevoStock,
          actualizado: new Date().toISOString(),
        })
        .eq("id", item.producto_id);
    }

    return cabecera;
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
