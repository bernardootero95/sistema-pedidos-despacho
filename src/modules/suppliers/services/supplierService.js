import { supabase } from "../../../config/supabase";

export const supplierService = {
  /**
   * Obtiene la lista de proveedores con paginación y búsqueda desde el
   * servidor (Server-Side), mismo patrón que clientService.
   */
  async getProveedoresPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("proveedores")
      .select("*", { count: "exact" })
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (searchTerm) {
      query = query.or(
        `numero_identificacion.ilike.%${searchTerm}%,nombre_comercial.ilike.%${searchTerm}%,correo.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error(
        "Error al cargar la lista de proveedores: " + error.message,
      );

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Obtiene todos los proveedores activos sin paginar, para el selector de
   * Nueva Compra. No usar para listados con tabla: para eso está
   * getProveedoresPaginados.
   */
  async getProveedoresActivos() {
    const { data, error } = await supabase
      .from("proveedores")
      .select("id, nombre_comercial, numero_identificacion")
      .eq("estado", true)
      .is("eliminado", null)
      .order("nombre_comercial", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar la lista de proveedores: " + error.message,
      );
    return data || [];
  },

  /**
   * Crea un nuevo proveedor
   */
  async crearProveedor(proveedorData) {
    const { data, error } = await supabase
      .from("proveedores")
      .insert([proveedorData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Ya existe un proveedor registrado con ese número de identificación.",
        );
      }
      throw new Error("Error al crear el proveedor: " + error.message);
    }

    return data;
  },

  /**
   * Actualiza los datos de un proveedor existente
   */
  async actualizarProveedor(id, proveedorData) {
    const dataToUpdate = {
      ...proveedorData,
      actualizado: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("proveedores")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "El número de identificación ya está en uso por otro proveedor.",
        );
      }
      throw new Error("Error al actualizar el proveedor: " + error.message);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo del proveedor
   */
  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("proveedores")
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del proveedor: " + error.message,
      );
    return data;
  },

  /**
   * Realiza un borrado lógico (Soft Delete) del proveedor
   */
  async eliminarProveedor(id) {
    const { data, error } = await supabase
      .from("proveedores")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error("Error al eliminar el proveedor: " + error.message);
    return data;
  },
};
