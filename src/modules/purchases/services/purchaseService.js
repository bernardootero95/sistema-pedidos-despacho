import { supabase } from "../../../config/supabase";

// compras_cabecera tiene dos FK a perfiles (usuario_id y recibido_por): el
// embed necesita el nombre de la FK o PostgREST lo rechaza por ambiguo.
const EMBED_USUARIO = "usuario:perfiles!compras_cabecera_usuario_id_fkey(nombre_completo)";
const EMBED_RECEPTOR = "receptor:perfiles!compras_cabecera_recibido_por_fkey(nombre_completo)";

export const purchaseService = {
  /**
   * Obtiene la lista de compras con paginación y búsqueda desde el
   * servidor (Server-Side). Incluye el proveedor y quien la registró.
   *
   * @param {{ estadoRecepcion?: string }} [filtros] estadoRecepcion filtra
   *   compras vigentes (no anuladas) por 'pendiente' o 'recibida'.
   */
  async getComprasPaginadas(page = 1, limit = 10, searchTerm = "", filtros = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("compras_cabecera")
      .select(
        `
        *,
        proveedor:proveedores(nombre_comercial),
        ${EMBED_USUARIO}
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("fecha_compra", { ascending: false });

    // Búsqueda solo por número de compra: PostgREST no admite filtrar con
    // `.or()` sobre columnas de una tabla embebida (proveedor), mismo
    // límite que ya asume dispatchService con codigo_despacho.
    if (searchTerm) {
      query = query.ilike("numero_compra", `%${searchTerm}%`);
    }

    if (filtros.estadoRecepcion) {
      query = query
        .eq("estado", "registrada")
        .eq("estado_recepcion", filtros.estadoRecepcion);
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error("Error al cargar la lista de compras: " + error.message);

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Obtiene la cabecera completa de una compra (proveedor, usuario) para
   * la página de detalle.
   */
  async getCompraCompleta(id) {
    const { data, error } = await supabase
      .from("compras_cabecera")
      .select(
        `
        *,
        proveedor:proveedores(nombre_comercial, numero_identificacion, telefono),
        ${EMBED_USUARIO},
        ${EMBED_RECEPTOR}
      `,
      )
      .eq("id", id)
      .single();

    if (error) throw new Error("Error al obtener la compra: " + error.message);
    return data;
  },

  /**
   * Obtiene las líneas de una compra específica con los datos del producto.
   */
  async obtenerDetallesCompra(compraId) {
    const { data, error } = await supabase
      .from("compras_detalle")
      .select(
        `
        *,
        producto:productos(codigo, nombre)
      `,
      )
      .eq("compra_id", compraId)
      .order("creado", { ascending: true });

    if (error)
      throw new Error(
        "Error al obtener los detalles de la compra: " + error.message,
      );
    return data || [];
  },

  /**
   * Historial de costo de compra de un producto puntual (para ver cuándo
   * subió o bajó de precio de costo), solo compras vigentes ('registrada')
   * y recibidas: una pendiente todavía no aportó su costo.
   */
  async getHistorialCostoProducto(productoId) {
    const { data, error } = await supabase
      .from("compras_detalle")
      .select(
        `
        cantidad,
        costo_unitario,
        compra:compras_cabecera!inner(numero_compra, fecha_compra, estado, proveedor:proveedores(nombre_comercial))
      `,
      )
      .eq("producto_id", productoId)
      .eq("compra.estado", "registrada")
      .eq("compra.estado_recepcion", "recibida")
      .order("creado", { ascending: false });

    if (error)
      throw new Error(
        "Error al obtener el historial de costo: " + error.message,
      );
    return data || [];
  },

  /**
   * Registra una compra de forma atómica mediante la función RPC
   * `crear_compra_transaccional`: valida cada producto y, si la compra llega
   * como recibida, suma el stock y recalcula el costo promedio ponderado,
   * todo en una única transacción. Una pendiente no mueve stock ni costo.
   *
   * @param {Object} cabeceraData - { proveedor_id, notas, fecha_compra, estado_recepcion }
   * @param {Array<{producto_id: string, cantidad: number, costo_unitario: number}>} detalles
   * @param {Array<{metodo_pago_id: string|null, monto: number}>} [pagos] pago
   *   al registrar. Con abonos a compras activos puede ser parcial o vacío
   *   (el resto queda como saldo al proveedor); sin abonos debe cubrir el
   *   total (y sin métodos de pago se omite: se paga en efectivo).
   */
  async crearCompraTransaccional(cabeceraData, detalles, pagos = null) {
    const { data, error } = await supabase.rpc("crear_compra_transaccional", {
      p_proveedor_id: cabeceraData.proveedor_id,
      p_notas: cabeceraData.notas || null,
      p_detalles: detalles,
      p_fecha_compra: cabeceraData.fecha_compra || null,
      p_estado_recepcion: cabeceraData.estado_recepcion || "recibida",
      ...(pagos && { p_pagos: pagos }),
    });

    if (error) {
      throw new Error(error.message || "Error al registrar la compra.");
    }

    return data;
  },

  /**
   * Marca una compra pendiente como recibida mediante
   * `recibir_compra_transaccional`: suma el stock y aplica el costo promedio
   * ponderado en ese momento, bloqueando la compra y los productos.
   *
   * @param {string} compraId
   * @param {string} fechaRecepcion YYYY-MM-DD (no futura ni anterior a la compra)
   */
  async recibirCompraTransaccional(compraId, fechaRecepcion) {
    const { data, error } = await supabase.rpc("recibir_compra_transaccional", {
      p_compra_id: compraId,
      p_fecha_recepcion: fechaRecepcion,
    });

    if (error) {
      throw new Error(error.message || "No se pudo marcar la compra como recibida.");
    }

    return data;
  },

  /**
   * Anula una compra de forma atómica mediante `anular_compra_transaccional`:
   * revierte el stock sumado y deshace su aporte al costo promedio.
   */
  async anularCompraTransaccional(compraId, motivo) {
    const { data, error } = await supabase.rpc(
      "anular_compra_transaccional",
      { p_compra_id: compraId, p_motivo: motivo },
    );

    if (error) {
      throw new Error(error.message || "No se pudo anular la compra.");
    }

    return data;
  },
};
