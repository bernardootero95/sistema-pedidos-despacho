import React, { useState } from "react";
import { userService } from "../services/userService";
import { X, Save, ShieldAlert } from "lucide-react";

export const UserForm = ({ roles, onSuccess, onCancel }) => {
  const domain = import.meta.env.VITE_COMPANY_DOMAIN || "empresa.com";

  const [formData, setFormData] = useState({
    nombre_completo: "",
    nombre_usuario: "",
    password: "",
    rol_id: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // Validación inmediata por campo
  const validateField = (name, value) => {
    let errorMsg = "";

    switch (name) {
      case "nombre_completo":
        if (!value.trim()) errorMsg = "El nombre completo es obligatorio.";
        break;
      case "nombre_usuario":
        if (!value.trim()) errorMsg = "El nombre de usuario es obligatorio.";
        else if (/\s/.test(value)) errorMsg = "No debe contener espacios.";
        else if (value.includes("@"))
          errorMsg = "Ingresa solo el usuario, sin el dominio.";
        break;
      case "password":
        if (!value) errorMsg = "La contraseña es obligatoria.";
        else if (value.length < 6)
          errorMsg = "Debe tener al menos 6 caracteres.";
        break;
      case "rol_id":
        if (!value) errorMsg = "Debes asignar un rol al usuario.";
        break;
      default:
        break;
    }
    return errorMsg;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    // Validar todo antes de enviar
    const newErrors = {
      nombre_completo: validateField(
        "nombre_completo",
        formData.nombre_completo,
      ),
      nombre_usuario: validateField("nombre_usuario", formData.nombre_usuario),
      password: validateField("password", formData.password),
      rol_id: validateField("rol_id", formData.rol_id),
    };

    setTouched({
      nombre_completo: true,
      nombre_usuario: true,
      password: true,
      rol_id: true,
    });
    setErrors(newErrors);

    // Si hay algún error, detenemos el flujo
    if (Object.values(newErrors).some((err) => err !== "")) return;

    setIsSubmitting(true);
    try {
      const email = `${formData.nombre_usuario.trim().toLowerCase()}@${domain}`;

      const payload = {
        email,
        password: formData.password,
        nombre_usuario: formData.nombre_usuario.trim().toLowerCase(),
        nombre_completo: formData.nombre_completo.trim(),
        rol_id: parseInt(formData.rol_id),
      };

      await userService.crearUsuario(payload);
      onSuccess(); // Cierra el modal y recarga la lista
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            Crear Nuevo Usuario
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {serverError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="user-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nombre Completo
              </label>
              <input
                type="text"
                name="nombre_completo"
                value={formData.nombre_completo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej. María Gómez"
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.nombre_completo ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              {errors.nombre_completo && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.nombre_completo}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nombre de Usuario (Login)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="nombre_usuario"
                  value={formData.nombre_usuario}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="ej: maria.gomez"
                  className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all pr-24 ${errors.nombre_usuario ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
                <span className="absolute right-3 top-3 text-xs font-bold text-slate-400 select-none">
                  @{domain}
                </span>
              </div>
              {errors.nombre_usuario && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.nombre_usuario}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Contraseña Temporal
              </label>
              <input
                type="text"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Debe tener al menos 6 caracteres"
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.password ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Rol de Sistema
              </label>
              <select
                name="rol_id"
                value={formData.rol_id}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.rol_id ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              >
                <option value="">-- Selecciona un rol --</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.id} className="capitalize">
                    {rol.nombre}
                  </option>
                ))}
              </select>
              {errors.rol_id && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.rol_id}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Creando..." : "Guardar Usuario"}
          </button>
        </div>
      </div>
    </div>
  );
};
