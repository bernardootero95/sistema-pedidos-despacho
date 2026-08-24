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
        correo,
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

  /**
   * Actualiza el correo de recuperación de un perfil. A diferencia de la
   * creación de usuarios, esto no requiere Edge Function ni SERVICE_ROLE:
   * `correo` solo vive en `perfiles` (nunca en auth.users), y las políticas
   * RLS ya cubren esta escritura (el propio usuario sobre su fila, o
   * gerencia/soporte sobre cualquiera).
   */
  async actualizarCorreo(userId, correo) {
    const { error } = await supabase
      .from("perfiles")
      .update({ correo: correo || null })
      .eq("id", userId);

    if (error)
      throw new Error("Error al actualizar el correo: " + error.message);

    return true;
  },

  /**
   * Cambia el rol de un usuario ya existente vía RPC transaccional. La
   * función en el servidor bloquea que un admin se cambie su propio rol
   * y valida que el rol destino exista y esté activo.
   */
  async actualizarRol(userId, rolId) {
    const { data, error } = await supabase.rpc("actualizar_rol_usuario", {
      p_user_id: userId,
      p_rol_id: rolId,
    });

    if (error)
      throw new Error("Error al actualizar el rol: " + error.message);

    return data;
  },

  /**
   * Restablece la contraseña de cualquier usuario (tenga o no correo real)
   * vía la Edge Function reset-user-password, que verifica del lado del
   * servidor que quien llama sea gerencia/soporte.
   */
  async resetearPassword(userId, nuevaPassword) {
    const { data, error } = await supabase.functions.invoke(
      "reset-user-password",
      { body: { user_id: userId, new_password: nuevaPassword } },
    );

    if (error)
      throw new Error(
        "Error de conexión con el servidor al restablecer la contraseña.",
      );
    if (data?.error) throw new Error(data.error);

    return data;
  },
};
