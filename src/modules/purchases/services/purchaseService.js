import { supabase } from "../../../config/supabase";

export const purchaseService = {
  /**
   * Obtiene la lista de compras con paginación y búsqueda desde el
   * servidor (Server-Side). Incluye el proveedor y quien la registró.
   */
  async getComprasPaginadas(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("compras_cabecera")
      .select(
        `
        *,
        proveedor:proveedores(nombre_comercial),
        usuario:perfiles(nombre_completo)
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
        usuario:perfiles(nombre_completo)
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
   * subió o bajó de precio de costo), solo compras vigentes ('registrada').
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
      .order("creado", { ascending: false });

    if (error)
      throw new Error(
        "Error al obtener el historial de costo: " + error.message,
      );
    return data || [];
  },

  /**
   * Registra una compra de forma atómica mediante la función RPC
   * `crear_compra_transaccional`: valida cada producto, suma el stock y
   * actualiza el último costo conocido, todo en una única transacción.
   *
   * @param {Object} cabeceraData - { proveedor_id, notas, fecha_compra }
   * @param {Array<{producto_id: string, cantidad: number, costo_unitario: number}>} detalles
   */
  async crearCompraTransaccional(cabeceraData, detalles) {
    const { data, error } = await supabase.rpc("crear_compra_transaccional", {
      p_proveedor_id: cabeceraData.proveedor_id,
      p_notas: cabeceraData.notas || null,
      p_detalles: detalles,
      p_fecha_compra: cabeceraData.fecha_compra || null,
    });

    if (error) {
      throw new Error(error.message || "Error al registrar la compra.");
    }

    return data;
  },

  /**
   * Anula una compra de forma atómica mediante `anular_compra_transaccional`:
   * revierte el stock sumado y recalcula el último costo de cada producto.
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
