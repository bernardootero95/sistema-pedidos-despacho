import { useState, useEffect } from "react";
import { supabase } from "../config/supabase";
import { authService } from "../modules/auth/services/authService";
import { AuthContext } from "./AuthContext";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const currentUser = await authService.getSession();
        setUser(currentUser);
      } catch (error) {
        console.error("No se pudo restaurar la sesión:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listener para detectar caducidad de tokens o cierres de sesión desde otras pestañas
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          const perfil = await authService.getPerfilCompleto(session.user.id);
          setUser({ ...session.user, ...perfil });
        } catch (error) {
          console.error(
            "Error al sincronizar perfil en AuthStateChange:",
            error,
          );
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (nombreUsuario, password) => {
    const loggedUser = await authService.login(nombreUsuario, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
