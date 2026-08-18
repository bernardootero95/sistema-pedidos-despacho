import { supabase } from "../../../config/supabase";

export const clientService = {
  /**
   * Obtiene la lista de clientes con paginación y búsqueda desde el servidor (Server-Side)
   */
  async getClientesPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("clientes")
      .select("*", { count: "exact" })
      .is("eliminado", null)
      .order("creado", { ascending: false });

    // Búsqueda del lado del servidor (ilike para ignorar mayúsculas/minúsculas)
    if (searchTerm) {
      query = query.or(
        `numero_identificacion.ilike.%${searchTerm}%,razon_social.ilike.%${searchTerm}%,primer_nombre.ilike.%${searchTerm}%,primer_apellido.ilike.%${searchTerm}%,correo.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error("Error al cargar la lista de clientes: " + error.message);

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Obtiene todos los clientes activos sin paginar, para selectores (ej. el
   * selector de cliente en Nuevo Pedido). No usar para listados con tabla:
   * para eso está getClientesPaginados.
   */
  async getClientesActivos() {
    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, razon_social, primer_nombre, primer_apellido, numero_identificacion",
      )
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (error)
      throw new Error("Error al cargar la lista de clientes: " + error.message);
    return data || [];
  },

  /**
   * Obtiene los tipos de identificación activos y no eliminados
   */
  async getTiposIdentificacion() {
    const { data, error } = await supabase
      .from("tipos_identificacion")
      .select("*")
      .eq("estado", true)
      .is("eliminado", null)
      .order("descripcion", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar tipos de identificación: " + error.message,
      );
    return data;
  },

  /**
   * Obtiene los municipios activos y no eliminados
   */
  async getMunicipios() {
    const { data, error } = await supabase
      .from("municipios")
      .select("*")
      .eq("estado", true)
      .is("eliminado", null)
      .order("departamento", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) throw new Error("Error al cargar municipios: " + error.message);
    return data;
  },

  /**
   * Crea un nuevo cliente en la base de datos
   */
  async crearCliente(clienteData) {
    const { data, error } = await supabase
      .from("clientes")
      .insert([clienteData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Ya existe un cliente con ese número de identificación.",
        );
      }
      throw new Error("Error al crear el cliente: " + error.message);
    }

    return data;
  },

  /**
   * Actualiza los datos de un cliente existente
   */
  async actualizarCliente(id, clienteData) {
    const dataToUpdate = {
      ...clienteData,
      actualizado: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("clientes")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "El número de identificación ya está en uso por otro cliente.",
        );
      }
      throw new Error("Error al actualizar el cliente: " + error.message);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo del cliente
   */
  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("clientes")
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del cliente: " + error.message,
      );
    return data;
  },

  /**
   * Realiza un borrado lógico del cliente
   */
  async eliminarCliente(id) {
    const { data, error } = await supabase
      .from("clientes")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error("Error al eliminar el cliente: " + error.message);
    return data;
  },
};
