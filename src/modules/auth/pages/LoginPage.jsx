import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { tenantConfig } from "../../../config/tenant";
import { ShieldAlert, LogIn, Building2 } from "lucide-react";

export const LoginPage = () => {
  const { login } = useAuth();

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

  const domain = import.meta.env.VITE_COMPANY_DOMAIN || "empresa.com";

  const validateField = (name, value) => {
    let errorMsg = "";
    if (name === "nombreUsuario") {
      if (!value.trim()) errorMsg = "El nombre de usuario es obligatorio.";
      else if (value.includes("@"))
        errorMsg = "Ingresa solo el usuario, sin el @dominio.";
    }
    if (name === "password") {
      if (!value.trim()) errorMsg = "La contraseña es obligatoria.";
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
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Acceso Seguro al Sistema Operativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10 border border-slate-200">
          {errors.general && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-center gap-3">
              <ShieldAlert className="text-red-500 w-5 h-5 shrink-0" />
              <p className="text-sm text-red-700 font-bold">{errors.general}</p>
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
                  placeholder="ej: juan.perez"
                  value={formData.nombreUsuario}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`block w-full rounded-xl sm:rounded-lg border px-4 py-3.5 sm:py-2.5 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                    errors.nombreUsuario
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                      : "border-slate-300 focus:border-primary focus:ring-primary/20"
                  }`}
                />
                <span className="absolute right-3 top-3.5 sm:top-2.5 text-xs font-bold text-slate-400 select-none">
                  @{domain}
                </span>
              </div>
              {errors.nombreUsuario && (
                <p className="mt-1.5 text-xs text-red-600 font-bold">
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
                  className={`block w-full rounded-xl sm:rounded-lg border px-4 py-3.5 sm:py-2.5 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                      : "border-slate-300 focus:border-primary focus:ring-primary/20"
                  }`}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 font-bold">
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-3.5 sm:py-2.5 px-4 border border-transparent rounded-xl sm:rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-hover active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 min-h-12 sm:min-h-0"
            >
              <LogIn className="w-5 h-5 sm:w-4 sm:h-4" />
              {isSubmitting ? "Autenticando..." : "Ingresar al Sistema"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
