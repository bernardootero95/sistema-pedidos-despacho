import { supabase } from "../../../config/supabase";

export const productService = {
  /**
   * Obtiene la lista de productos con paginación y búsqueda (Server-Side)
   */
  async getProductosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("productos")
      .select(
        `
        *,
        categorias_productos (id, nombre)
      `,
        { count: "exact" },
      )
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (searchTerm) {
      query = query.or(
        `codigo_sku.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error(
        "Error al cargar la lista de productos: " + error.message,
      );

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Obtiene las categorías activas para los selectores de formularios
   */
  async getCategorias() {
    const { data, error } = await supabase
      .from("categorias_productos")
      .select("id, nombre")
      .eq("estado", true)
      .is("eliminado", null)
      .order("nombre", { ascending: true });

    if (error)
      throw new Error("Error al cargar las categorías: " + error.message);
    return data;
  },

  /**
   * Crea un nuevo producto
   */
  async crearProducto(productoData) {
    const { data, error } = await supabase
      .from("productos")
      .insert([productoData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un producto con ese Código/SKU.");
      }
      throw new Error("Error al crear el producto: " + error.message);
    }

    return data;
  },

  /**
   * Actualiza los datos de un producto
   */
  async actualizarProducto(id, productoData) {
    const dataToUpdate = {
      ...productoData,
      actualizado: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("productos")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("El Código/SKU ya está en uso por otro producto.");
      }
      throw new Error("Error al actualizar el producto: " + error.message);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo
   */
  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("productos")
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del producto: " + error.message,
      );
    return data;
  },

  /**
   * Realiza un borrado lógico
   */
  async eliminarProducto(id) {
    const { data, error } = await supabase
      .from("productos")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error("Error al eliminar el producto: " + error.message);
    return data;
  },
};
