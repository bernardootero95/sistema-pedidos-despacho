import { supabase } from "../../../config/supabase";

// PostgREST corta cada respuesta en 1000 filas (max-rows de Supabase): una
// toma lleva una línea por producto, así que el detalle se lee por tramos.
const TAMANO_TRAMO = 1000;

const num = (valor) => (valor == null ? null : Number(valor));

const normalizarLinea = (linea) => ({
  id: linea.id,
  productoId: linea.producto_id,
  codigo: linea.producto?.codigo ?? "",
  nombre: linea.producto?.nombre ?? "",
  cantidadSistema: Number(linea.cantidad_sistema),
  costoUnitario: num(linea.costo_unitario),
  precioVenta: Number(linea.precio_venta),
  cantidadContada: num(linea.cantidad_contada),
  diferencia: num(linea.diferencia),
});

export const physicalCountService = {
  /** Lista de tomas físicas con paginación server-side. */
  async getTomasPaginadas(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("tomas_fisicas")
      .select("*, usuario:perfiles!usuario_id(nombre_completo)", { count: "exact" })
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (searchTerm) {
      query = query.ilike("numero_toma", `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error("Error al cargar las tomas físicas: " + error.message);

    return { data, total: count, totalPages: Math.ceil(count / limit) };
  },

  /** Cabecera de una toma con quien la creó y quien la aplicó. */
  async getToma(id) {
    const { data, error } = await supabase
      .from("tomas_fisicas")
      .select("*, usuario:perfiles!usuario_id(nombre_completo), aplicador:perfiles!aplicada_por(nombre_completo)")
      .eq("id", id)
      .single();

    if (error) throw new Error("Error al obtener la toma física: " + error.message);
    return data;
  },

  /** Todas las líneas de la toma (un producto por línea), ordenadas por nombre. */
  async getLineas(tomaId) {
    const lineas = [];

    for (let desde = 0; ; desde += TAMANO_TRAMO) {
      const { data, error } = await supabase
        .from("tomas_fisicas_detalle")
        .select(
          "id, producto_id, cantidad_sistema, costo_unitario, precio_venta, cantidad_contada, diferencia, producto:productos(codigo, nombre)",
        )
        .eq("toma_id", tomaId)
        .order("id", { ascending: true })
        .range(desde, desde + TAMANO_TRAMO - 1);

      if (error) throw new Error("Error al cargar los productos de la toma: " + error.message);

      lineas.push(...data);
      if (data.length < TAMANO_TRAMO) break;
    }

    return lineas.map(normalizarLinea).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },

  /** Crea una toma en borrador con la foto del inventario del sistema. */
  async crearToma(notas) {
    const { data, error } = await supabase.rpc("crear_toma_fisica", { p_notas: notas || null });
    if (error) throw new Error(error.message || "No se pudo crear la toma física.");
    return data;
  },

  /**
   * Guarda conteos (lote). `conteos` es un array de
   * { productoId, cantidadContada } donde null borra el conteo del producto.
   */
  async guardarConteos(tomaId, conteos) {
    const { data, error } = await supabase.rpc("guardar_conteo_toma_fisica", {
      p_toma_id: tomaId,
      p_conteos: conteos.map((c) => ({ producto_id: c.productoId, cantidad_contada: c.cantidadContada })),
    });
    if (error) throw new Error(error.message || "No se pudo guardar el conteo.");
    return data;
  },

  /** Aplica la toma: ajusta el stock de los productos contados. */
  async aplicarToma(tomaId) {
    const { data, error } = await supabase.rpc("aplicar_toma_fisica", { p_toma_id: tomaId });
    if (error) throw new Error(error.message || "No se pudo aplicar la toma física.");
    return data;
  },

  async cancelarToma(tomaId) {
    const { data, error } = await supabase.rpc("cancelar_toma_fisica", { p_toma_id: tomaId });
    if (error) throw new Error(error.message || "No se pudo cancelar la toma física.");
    return data;
  },
};
