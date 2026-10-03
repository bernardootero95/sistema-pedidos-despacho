import { supabase } from "../../../config/supabase";

const CAMPOS_CLIENTE =
  "razon_social, primer_nombre, primer_apellido, tipo_identificacion, numero_identificacion, digito_verificacion, direccion, telefono, correo";

export const quoteService = {
  /**
   * Lista de cotizaciones con paginación y búsqueda desde el servidor.
   * Busca solo por número: PostgREST no permite `.or()` sobre columnas de
   * una tabla embebida (cliente), mismo límite que purchaseService.
   */
  async getCotizacionesPaginadas(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("cotizaciones_cabecera")
      .select(
        `
        *,
        cliente:clientes(${CAMPOS_CLIENTE}),
        usuario:perfiles(nombre_completo)
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("fecha_cotizacion", { ascending: false });

    if (searchTerm) {
      query = query.ilike("numero_cotizacion", `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error("Error al cargar las cotizaciones: " + error.message);

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /** Cotización completa con cliente, quien la creó y el pedido generado. */
  async getCotizacionCompleta(id) {
    const { data, error } = await supabase
      .from("cotizaciones_cabecera")
      .select(
        `
        *,
        cliente:clientes(${CAMPOS_CLIENTE}),
        usuario:perfiles(nombre_completo),
        pedido:pedidos_cabecera(numero_pedido)
      `,
      )
      .eq("id", id)
      .is("eliminado", null)
      .single();

    if (error)
      throw new Error("Error al obtener la cotización: " + error.message);
    return data;
  },

  async obtenerDetallesCotizacion(cotizacionId) {
    const { data, error } = await supabase
      .from("cotizaciones_detalle")
      .select("*, producto:productos(codigo, nombre)")
      .eq("cotizacion_id", cotizacionId)
      .order("creado", { ascending: true });

    if (error)
      throw new Error(
        "Error al obtener los productos de la cotización: " + error.message,
      );
    return data || [];
  },

  /**
   * Crea la cotización con `crear_cotizacion_transaccional`: el servidor
   * resuelve los precios (normal/mayorista/personalizado) y valida todo.
   *
   * @param {{cliente_id: string, fecha_vencimiento: string, notas?: string}} cabeceraData
   * @param {Array<{producto_id: string, cantidad: number, tipo_precio?: string, tipo_precio_id?: string|null}>} detalles
   */
  async crearCotizacion(cabeceraData, detalles) {
    const { data, error } = await supabase.rpc("crear_cotizacion_transaccional", {
      p_cliente_id: cabeceraData.cliente_id,
      p_fecha_vencimiento: cabeceraData.fecha_vencimiento,
      p_notas: cabeceraData.notas || null,
      p_detalles: detalles.map((item) => ({
        producto_id: item.producto_id,
        cantidad: Number(item.cantidad),
        tipo_precio: item.tipo_precio || "normal",
        tipo_precio_id: item.tipo_precio_id ?? null,
      })),
    });

    if (error) {
      throw new Error(error.message || "Error al crear la cotización.");
    }
    return data;
  },

  async anularCotizacion(cotizacionId, motivo) {
    const { data, error } = await supabase.rpc("anular_cotizacion_transaccional", {
      p_cotizacion_id: cotizacionId,
      p_motivo: motivo,
    });

    if (error) {
      throw new Error(error.message || "No se pudo anular la cotización.");
    }
    return data;
  },

  /**
   * Convierte la cotización en pedido de forma atómica. Devuelve
   * `{ pedido_id, numero_pedido, total_pedido, total_cotizado }`: el pedido
   * usa los precios vigentes, así que los totales pueden diferir.
   */
  async convertirEnPedido(cotizacionId) {
    const { data, error } = await supabase.rpc("convertir_cotizacion_en_pedido", {
      p_cotizacion_id: cotizacionId,
    });

    if (error) {
      throw new Error(error.message || "No se pudo convertir en pedido.");
    }
    return data;
  },
};
