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
      .select("*", { count: "exact" })
      .is("eliminado", null)
      .order("creado", { ascending: false });

    // Búsqueda por código, código de barras o nombre
    if (searchTerm) {
      query = query.or(
        `codigo.ilike.%${searchTerm}%,codigo_barra.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%`,
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
   * Obtiene todos los productos activos sin paginar, para selectores (ej. el
   * buscador de productos en Nuevo Pedido). No usar para listados con
   * tabla: para eso está getProductosPaginados.
   */
  async getProductosActivos() {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, codigo, precio_venta, iva, inc, disponible")
      .is("eliminado", null)
      .order("nombre", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar la lista de productos: " + error.message,
      );
    return data || [];
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
        throw new Error("Ya existe un producto registrado con ese código.");
      }
      throw new Error("Error al crear el producto: " + error.message);
    }

    return data;
  },

  /**
   * Actualiza un producto existente
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
        throw new Error(
          "El código ingresado ya está en uso por otro producto.",
        );
      }
      throw new Error("Error al actualizar el producto: " + error.message);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo (Suspensión)
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
   * Realiza un borrado lógico (Soft Delete)
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
