import { supabase } from "../../../config/supabase";

const DOMAIN = import.meta.env.VITE_COMPANY_DOMAIN || "empresa.com";

export const authService = {
  /**
   * Inicia sesión combinando el nombre de usuario corto con el dominio de la empresa
   */
  async login(nombreUsuario, password, captchaToken) {
    try {
      const correo = `${nombreUsuario.trim().toLowerCase()}@${DOMAIN}`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: password,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (error) throw error;

      // Obtener el perfil extendido y rol desde nuestra base de datos SQL
      const perfil = await this.getPerfilCompleto(data.user.id);
      return { ...data.user, ...perfil };
    } catch (error) {
      // Extraer correctamente el mensaje del objeto de error de Supabase
      const errorMessage =
        error?.message ||
        error?.error_description ||
        "Error de conexión con el servidor.";
      console.error("[AuthService] Error detallado:", errorMessage);
      throw new Error(this.traducirErrorAuth(errorMessage), { cause: error });
    }
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Obtiene el perfil vinculado al usuario de Supabase y su rol activo
   */
  async getPerfilCompleto(userId) {
    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select(
        `
        id,
        nombre_usuario,
        nombre_completo,
        estado,
        roles (
          nombre,
          permisos
        )
      `,
      )
      .eq("id", userId)
      .single();

    if (errorPerfil)
      throw new Error(
        "No se pudo cargar el perfil del usuario de la base de datos.",
      );
    if (!perfil.estado)
      throw new Error("Este usuario se encuentra inactivo en el sistema.");

    return {
      id: perfil.id,
      nombre_usuario: perfil.nombre_usuario,
      nombre_completo: perfil.nombre_completo,
      rol: perfil.roles.nombre,
      permisos: perfil.roles.permisos,
    };
  },

  /**
   * Recupera la sesión activa al recargar la página
   */
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) return null;

    const perfil = await this.getPerfilCompleto(session.user.id);
    return { ...session.user, ...perfil };
  },

  /**
   * Traductor de errores de Supabase para la Interfaz de Usuario
   */
  traducirErrorAuth(mensaje) {
    if (mensaje.includes("Invalid login credentials"))
      return "Nombre de usuario o contraseña incorrectos.";
    if (mensaje.includes("Email not confirmed"))
      return "La cuenta no ha sido habilitada por gerencia.";
    if (mensaje.includes("bloqueada temporalmente")) return mensaje;
    return "Ocurrió un error de seguridad al intentar iniciar sesión.";
  },

  /**
   * Flujo self-service de "olvidé mi contraseña", solo disponible para
   * cuentas con `correo` configurado (ver tiene_correo_recuperacion en la
   * migración). El envío se dispara con el email sintético de login, no
   * con `correo`: Supabase solo entrega a la dirección registrada en
   * auth.users, que sigue siendo nombre_usuario@DOMAIN.
   *
   * @returns {Promise<{ enviado: boolean }>}
   */
  async solicitarRecuperacionPassword(nombreUsuario, captchaToken) {
    const usuario = nombreUsuario.trim().toLowerCase();

    const { data: tieneCorreo, error: errorConsulta } = await supabase.rpc(
      "tiene_correo_recuperacion",
      { p_nombre_usuario: usuario },
    );

    if (errorConsulta) {
      throw new Error("No se pudo verificar la cuenta. Intenta de nuevo.");
    }
    if (!tieneCorreo) {
      return { enviado: false };
    }

    const correoLogin = `${usuario}@${DOMAIN}`;
    const { error } = await supabase.auth.resetPasswordForEmail(correoLogin, {
      redirectTo: `${window.location.origin}/restablecer-password`,
      ...(captchaToken && { captchaToken }),
    });

    if (error) {
      throw new Error("No se pudo enviar el enlace de recuperación.");
    }
    return { enviado: true };
  },

  /**
   * Fija una nueva contraseña para la sesión actual. La reutilizan tanto
   * la página de restablecimiento (tras el enlace de recuperación) como el
   * modal de "cambiar mi contraseña" (usuario ya logueado): en ambos casos
   * ya existe una sesión válida, así que es la misma llamada.
   */
  async actualizarPassword(nuevaPassword) {
    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword,
    });
    if (error) {
      throw new Error(
        error.message || "No se pudo actualizar la contraseña.",
      );
    }
    return true;
  },
};
