import React, { useState, useEffect } from "react";
import { userService } from "../services/userService";
import { UserForm } from "../components/UserForm";
import {
  UserCog,
  Search,
  PlusCircle,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export const UsersPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para el modal de creación
  const [isFormOpen, setIsFormOpen] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Promise.all para cargar usuarios y roles en paralelo (Rendimiento)
      const [usuariosData, rolesData] = await Promise.all([
        userService.getUsuarios(),
        userService.getRoles(),
      ]);
      setUsuarios(usuariosData);
      setRoles(rolesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleToggleEstado = async (userId, estadoActual) => {
    try {
      // Optimistic UI update para fluidez sin esperas
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, estado: !estadoActual } : u,
        ),
      );
      await userService.toggleEstado(userId, !estadoActual);
    } catch (err) {
      alert(err.message);
      cargarDatos();
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    cargarDatos(); // Refrescamos la tabla para ver al nuevo usuario
  };

  const filteredUsers = usuarios.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roles.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const domain = import.meta.env.VITE_COMPANY_DOMAIN || "empresa.com";

  if (loading && usuarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-semibold">Cargando personal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* MODAL DE CREACIÓN */}
      {isFormOpen && (
        <UserForm
          roles={roles}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Gestión de Personal</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Administración de accesos, roles y perfiles operativos del sistema.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-semibold rounded-xl sm:rounded-lg shadow-sm transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4 flex-shrink-0" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nombre, usuario o rol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="block sm:hidden divide-y divide-slate-200">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {user.nombre_completo}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    @{user.nombre_usuario}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-primary" />{" "}
                  {user.roles.nombre}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${user.estado ? "text-emerald-600" : "text-red-500"}`}
                >
                  {user.estado ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Suspendido
                    </>
                  )}
                </span>
                <button
                  onClick={() => handleToggleEstado(user.id, user.estado)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    user.estado
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {user.estado ? "Suspender" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Nombre Completo</th>
                <th className="py-3.5 px-6">Credenciales</th>
                <th className="py-3.5 px-6">Rol Asignado</th>
                <th className="py-3.5 px-6">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {user.nombre_completo}
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-700">
                      {user.nombre_usuario}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {user.nombre_usuario}@{domain}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {user.roles.nombre}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {user.estado ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Activo
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Suspendido
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleToggleEstado(user.id, user.estado)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        user.estado
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {user.estado ? "Suspender Acceso" : "Reactivar Acceso"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
