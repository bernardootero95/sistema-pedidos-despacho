// src/modules/orders/services/orderService.js
import { supabase } from "../../../config/supabase";

/**
 * Aplica al query los filtros de estado, rango de fechas y vendedor
 * compartidos entre el listado paginado y la búsqueda de pedido adyacente
 * (siguiente/anterior), para que ambos recorran exactamente el mismo
 * subconjunto de pedidos.
 */
function aplicarFiltrosPedidos(query, filtros = {}) {
  const { estado, fechaDesde, fechaHasta, vendedorId } = filtros;

  if (estado) query = query.eq("estado", estado);
  if (vendedorId) query = query.eq("vendedor_id", vendedorId);
  if (fechaDesde) query = query.gte("fecha_pedido", `${fechaDesde}T00:00:00`);
  if (fechaHasta) query = query.lte("fecha_pedido", `${fechaHasta}T23:59:59.999`);

  return query;
}

export const orderService = {
  async getPedidosPaginados(page = 1, limit = 10, searchTerm = "", filtros = {}) {
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

    query = aplicarFiltrosPedidos(query, filtros);

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
   * @param {Array} detallesData - [{ producto_id, cantidad, tipo_precio }, ...]
   */
  async crearPedido(cabeceraData, detallesData) {
    const detallesParaRpc = detallesData.map((item) => ({
      producto_id: item.producto_id,
      cantidad: Number(item.cantidad),
      tipo_precio: item.tipo_precio || "normal",
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
   * Edita un pedido pendiente (productos, cantidades, notas) de forma
   * atómica mediante la función RPC `editar_pedido_transaccional`. Igual
   * que crear, el precio/IVA/INC de cada línea se recalcula en el
   * servidor desde `productos` — nunca se confía en lo que mande el
   * cliente. Rechaza pedidos que ya no estén 'pendiente'.
   *
   * @param {string} pedidoId
   * @param {{ notas?: string, detalles: Array<{producto_id: string, cantidad: number, tipo_precio?: string}> }} data
   */
  async editarPedido(pedidoId, { notas, detalles }) {
    const detallesParaRpc = detalles.map((item) => ({
      producto_id: item.producto_id,
      cantidad: Number(item.cantidad),
      tipo_precio: item.tipo_precio || "normal",
    }));

    const { data, error } = await supabase.rpc("editar_pedido_transaccional", {
      p_pedido_id: pedidoId,
      p_notas: notas || null,
      p_detalles: detallesParaRpc,
    });

    if (error) {
      throw new Error(error.message || "Error al editar el pedido.");
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

  /**
   * Busca el pedido inmediatamente anterior o siguiente a `creadoActual`
   * respetando el mismo orden (`creado` descendente) y los mismos filtros
   * de búsqueda/estado/fecha/vendedor que el listado, para que la
   * navegación siguiente/anterior desde el detalle de un pedido recorra
   * exactamente el mismo conjunto que el usuario tenía filtrado en la
   * tabla. "anterior" = fila de arriba (más reciente), "siguiente" = fila
   * de abajo (más antigua).
   *
   * @param {{ creadoActual: string, direccion: "anterior"|"siguiente", searchTerm?: string, filtros?: Object }} params
   */
  async getPedidoAdyacente({
    creadoActual,
    direccion,
    searchTerm = "",
    filtros = {},
  }) {
    let query = supabase
      .from("pedidos_cabecera")
      .select("id")
      .is("eliminado", null);

    if (searchTerm) {
      query = query.ilike("numero_pedido", `%${searchTerm}%`);
    }
    query = aplicarFiltrosPedidos(query, filtros);

    if (direccion === "anterior") {
      query = query.gt("creado", creadoActual).order("creado", { ascending: true });
    } else {
      query = query.lt("creado", creadoActual).order("creado", { ascending: false });
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error("Error al buscar el pedido adyacente: " + error.message);
    return data;
  },

  /**
   * Corrige la fecha de entrega de un pedido ya entregado, vía RPC
   * `actualizar_fecha_entrega_pedido`. Solo gerencia/soporte pueden
   * llamarla (el RPC lo valida en el servidor); el trigger de auditoría
   * de pedidos_cabecera deja registrado el antes/después en `auditoria`,
   * visible en el historial del pedido.
   *
   * @param {string} pedidoId
   * @param {Date|string} fechaEntrega
   */
  async actualizarFechaEntrega(pedidoId, fechaEntrega) {
    const { data, error } = await supabase.rpc("actualizar_fecha_entrega_pedido", {
      p_pedido_id: pedidoId,
      p_fecha_entrega: fechaEntrega instanceof Date ? fechaEntrega.toISOString() : fechaEntrega,
    });

    if (error) {
      throw new Error(error.message || "Error al corregir la fecha de entrega.");
    }

    return data;
  },

  /**
   * Historial de cambios de un pedido (quién y cuándo lo actualizó),
   * leído de la tabla genérica `auditoria` que ya usa el trigger
   * `registrar_auditoria` (mismo mecanismo que perfiles/roles). Se acota
   * al pedido puntual porque la RLS de `auditoria` ya filtra por lo que
   * el usuario puede ver, no hace falta filtrar más acá.
   *
   * @param {string} pedidoId
   */
  async obtenerHistorialPedido(pedidoId) {
    const { data, error } = await supabase
      .from("auditoria")
      .select("id, operacion, datos_anteriores, datos_nuevos, usuario_id, creado")
      .eq("tabla", "pedidos_cabecera")
      .eq("registro_id", pedidoId)
      .order("creado", { ascending: false });

    if (error) {
      throw new Error(`Error al obtener el historial del pedido: ${error.message}`);
    }

    const usuarioIds = [...new Set((data || []).map((r) => r.usuario_id).filter(Boolean))];
    let perfilesPorId = {};
    if (usuarioIds.length > 0) {
      const { data: perfiles } = await supabase
        .from("perfiles")
        .select("id, nombre_completo")
        .in("id", usuarioIds);
      perfilesPorId = Object.fromEntries((perfiles || []).map((p) => [p.id, p.nombre_completo]));
    }

    return (data || []).map((registro) => ({
      ...registro,
      usuarioNombre: perfilesPorId[registro.usuario_id] || null,
    }));
  },

  /**
   * Anula un pedido mediante la función RPC `anular_pedido_transaccional`.
   * A diferencia del update directo que reemplazó, esta función devuelve al
   * stock las cantidades del pedido cuando corresponde (pedidos
   * 'pendiente'/'despachado' aún no entregados), evitando que quede
   * descontado para siempre en `productos.disponible`.
   */
  async anularPedido(id, motivoAnulacion) {
    const { data, error } = await supabase.rpc("anular_pedido_transaccional", {
      p_pedido_id: id,
      p_motivo: motivoAnulacion,
    });

    if (error) {
      throw new Error(error.message || "Error al anular el pedido.");
    }

    return data;
  },
};
