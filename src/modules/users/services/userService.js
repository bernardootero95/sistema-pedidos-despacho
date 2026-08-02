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
    const { data, error } = await supabase
      .from("perfiles")
      .update({ estado: nuevoEstado })
      .eq("id", userId)
      .select()
      .single();

    if (error)
      throw new Error(
        "Error al actualizar el estado del usuario: " + error.message,
      );
    return data;
  },
};
