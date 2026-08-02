import { supabase } from "../../../config/supabase";

export const userService = {
  /**
   * Obtiene la lista completa de usuarios activos e inactivos (no eliminados lógicamente)
   */
  async getUsuarios() {
    const { data, error } = await supabase
      .from("perfiles")
      .select(
        `
        id,
        nombre_usuario,
        nombre_completo,
        estado,
        roles (
          id,
          nombre
        )
      `,
      )
      .is("eliminado", null)
      .order("creado", { ascending: false });

    if (error)
      throw new Error("Error al cargar la lista de usuarios: " + error.message);
    return data;
  },

  /**
   * Obtiene los roles disponibles para futuros formularios de creación/edición
   */
  async getRoles() {
    const { data, error } = await supabase
      .from("roles")
      .select("id, nombre")
      .eq("estado", true)
      .is("eliminado", null);

    if (error) throw new Error("Error al cargar los roles: " + error.message);
    return data;
  },

  /**
   * Alterna el acceso de un usuario al sistema (Activo / Inactivo) mediante RPC seguro
   */
  async toggleEstado(userId, nuevoEstado) {
    // Usamos rpc() para invocar la función segura en el backend y evitar bloqueos RLS 403/406
    const { data, error } = await supabase.rpc("toggle_user_status", {
      p_user_id: userId,
      p_new_status: nuevoEstado,
    });

    if (error)
      throw new Error(
        "Error al actualizar el estado del usuario: " + error.message,
      );

    return data;
  },

  /**
   * Solicita a la Edge Function la creación segura de un nuevo usuario
   */
  async crearUsuario(userData) {
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: userData,
    });

    if (error)
      throw new Error(
        "Error de conexión con el servidor al intentar crear el usuario.",
      );
    if (data?.error) throw new Error(data.error);

    return data;
  },
};
