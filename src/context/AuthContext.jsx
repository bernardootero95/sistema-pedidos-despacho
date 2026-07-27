import React, { createContext, useContext, useState, useEffect } from "react";
import { DEMO_DATA } from "../mock/demoData";
import { tenantConfig } from "../config/tenant";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión guardada en localStorage para la demo
    const savedUser = localStorage.getItem("demo_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Iniciar por defecto con rol Gerencia para facilitar la demo al cliente
      const defaultUser = DEMO_DATA.usuarios[0];
      setUser(defaultUser);
      localStorage.setItem("demo_user", JSON.stringify(defaultUser));
    }
    setLoading(false);
  }, []);

  // Simulación de Login con validación de nombre de usuario sin correo
  const login = async (nombreUsuario, password) => {
    // Para la presentación, validamos contra nuestro DEMO_DATA
    const foundUser = DEMO_DATA.usuarios.find(
      (u) =>
        u.nombre_usuario.toLowerCase() === nombreUsuario.toLowerCase().trim(),
    );

    if (!foundUser) {
      throw new Error(`El usuario "${nombreUsuario}" no existe en el sistema.`);
    }

    // Transformación transparente exigida: usuario -> usuario@empresa.com
    const dominio = DEMO_DATA.empresa.dominio;
    const correoGenerado = `${foundUser.nombre_usuario}@${dominio}`;
    console.log(`[Auth Demo] Conectando internamente con: ${correoGenerado}`);

    setUser(foundUser);
    localStorage.setItem("demo_user", JSON.stringify(foundUser));
    return foundUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("demo_user");
  };

  // Función exclusiva para la demo: permite al cliente cambiar de rol con 1 clic
  const switchDemoRole = (rolNombre) => {
    const newUser = DEMO_DATA.usuarios.find((u) => u.rol === rolNombre);
    if (newUser) {
      setUser(newUser);
      localStorage.setItem("demo_user", JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, switchDemoRole, loading }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
