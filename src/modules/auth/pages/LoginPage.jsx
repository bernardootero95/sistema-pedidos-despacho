import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { tenantConfig } from "../../../config/tenant";
import { DEMO_DATA } from "../../../mock/demoData";
import { ShieldAlert, LogIn, UserCheck, Building2 } from "lucide-react";

export const LoginPage = () => {
  const { login, switchDemoRole } = useAuth();

  const [formData, setFormData] = useState({ nombreUsuario: "", password: "" });
  const [errors, setErrors] = useState({
    nombreUsuario: "",
    password: "",
    general: "",
  });
  const [touched, setTouched] = useState({
    nombreUsuario: false,
    password: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validación inmediata al escribir o desenfocar (SOLID: Lógica de validación limpia)
  const validateField = (name, value) => {
    let errorMsg = "";
    if (name === "nombreUsuario") {
      if (!value.trim()) errorMsg = "El nombre de usuario es obligatorio.";
      else if (value.includes("@"))
        errorMsg = "Ingresa solo el usuario, sin @dominio.com";
    }
    if (name === "password") {
      if (!value.trim()) errorMsg = "La contraseña es obligatoria.";
      else if (value.length < 4) errorMsg = "Mínimo 4 caracteres para la demo.";
    }
    return errorMsg;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name, value),
        general: "",
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userError = validateField("nombreUsuario", formData.nombreUsuario);
    const passError = validateField("password", formData.password);

    setTouched({ nombreUsuario: true, password: true });
    setErrors({ nombreUsuario: userError, password: passError, general: "" });

    if (userError || passError) return;

    setIsSubmitting(true);
    try {
      await login(formData.nombreUsuario, formData.password);
      // La redirección la manejará el enrutador principal al detectar a 'user'
    } catch (error) {
      setErrors((prev) => ({ ...prev, general: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 text-primary">
          <Building2 className="w-12 h-12" />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900">
          {tenantConfig.name}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sistema Integrado de Pedidos y Despacho
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10 border border-slate-200">
          {errors.general && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-center gap-3">
              <ShieldAlert className="text-red-500 w-5 h-5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {errors.general}
              </p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="nombreUsuario"
                className="block text-sm font-semibold text-slate-700"
              >
                Nombre de Usuario
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="nombreUsuario"
                  name="nombreUsuario"
                  type="text"
                  autoComplete="username"
                  placeholder="ej: gerente, vendedor1, despachos"
                  value={formData.nombreUsuario}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`block w-full rounded-lg border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                    errors.nombreUsuario
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                      : "border-slate-300 focus:border-primary focus:ring-primary/20"
                  }`}
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 select-none">
                  @{DEMO_DATA.empresa.dominio}
                </span>
              </div>
              {errors.nombreUsuario && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.nombreUsuario}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`block w-full rounded-lg border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                      : "border-slate-300 focus:border-primary focus:ring-primary/20"
                  }`}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {isSubmitting ? "Verificando..." : "Iniciar Sesión"}
            </button>
          </form>

          {/* PANEL ESPECÍFICO PARA PRESENTACIÓN AL CLIENTE */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Acceso Rápido para Presentación (Demo)
              </span>
            </div>
            <p className="text-xs text-slate-500 text-center mb-4">
              Haz clic en cualquier rol para ingresar al sistema
              instantáneamente sin escribir contraseña:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_DATA.usuarios.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setFormData({
                      nombreUsuario: u.nombre_usuario,
                      password: "demo",
                    });
                    switchDemoRole(u.rol);
                  }}
                  className="text-left px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-center"
                >
                  <span className="font-bold text-slate-900 capitalize">
                    {u.rol}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    {u.nombre_completo}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
