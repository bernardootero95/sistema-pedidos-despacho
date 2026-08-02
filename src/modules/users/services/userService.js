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
   * Alterna el acceso de un usuario al sistema (Activo / Inactivo)
   */
  async toggleEstado(userId, nuevoEstado) {
    // Retiramos .single() para prevenir el colapso 406 si RLS bloquea la operación
    const { data, error } = await supabase
      .from("perfiles")
      .update({ estado: nuevoEstado })
      .eq("id", userId)
      .select();

    if (error)
      throw new Error(
        "Error al actualizar el estado del usuario: " + error.message,
      );

    // Validación manual de seguridad y existencia
    if (!data || data.length === 0) {
      throw new Error(
        "Operación denegada. Verifica que tengas permisos (RLS) para modificar perfiles.",
      );
    }

    return data[0];
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
