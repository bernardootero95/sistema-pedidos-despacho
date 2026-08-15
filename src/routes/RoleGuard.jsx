import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

/**
 * Protege un grupo de rutas anidadas según el rol del usuario autenticado.
 * Se monta siempre dentro del layout ya protegido por autenticación en
 * AppRouter, así que aquí solo se valida el rol: si no está autorizado,
 * lo manda al Dashboard (accesible para todos los roles) en vez de un 404.
 */
export const RoleGuard = ({ roles }) => {
  const { user } = useAuth();
  const autorizado = Boolean(user) && roles.includes(user.rol);

  return autorizado ? <Outlet /> : <Navigate to="/dashboard" replace />;
};
