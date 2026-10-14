import { useState } from "react";
import { userService } from "../services/userService";
import { validateUserField, validateUserForm } from "../utils/userValidations";
import { useAuth } from "../../../context/useAuth";
import { X, Save, ShieldAlert } from "lucide-react";

/**
 * Alta y edición de usuarios. En modo edición (userToEdit presente) se
 * pueden modificar el correo de recuperación y el rol; usuario y
 * contraseña no tienen flujo de edición todavía (fuera de alcance de
 * este form).
 */
export const UserForm = ({ roles, userToEdit = null, onSuccess, onCancel }) => {
  const domain = import.meta.env.VITE_COMPANY_DOMAIN || "empresa.com";
  const { user: usuarioActual } = useAuth();
  const editMode = Boolean(userToEdit);
  const editandoPropioUsuario = editMode && userToEdit.id === usuarioActual?.id;

  const [formData, setFormData] = useState({
    nombre_completo: userToEdit?.nombre_completo || "",
    nombre_usuario: userToEdit?.nombre_usuario || "",
    password: "",
    rol_id: userToEdit?.roles?.id ? String(userToEdit.roles.id) : "",
    correo: userToEdit?.correo || "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateUserField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateUserField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validateUserForm(formData, { editMode });
    setTouched({
      nombre_completo: true,
      nombre_usuario: true,
      password: true,
      rol_id: true,
      correo: true,
    });
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (editMode) {
        await userService.actualizarCorreo(userToEdit.id, formData.correo.trim());

        const rolOriginal = userToEdit.roles?.id ? String(userToEdit.roles.id) : "";
        if (formData.rol_id !== rolOriginal) {
          await userService.actualizarRol(
            userToEdit.id,
            parseInt(formData.rol_id),
          );
        }
      } else {
        const email = `${formData.nombre_usuario.trim().toLowerCase()}@${domain}`;
        const payload = {
          email,
          password: formData.password,
          nombre_usuario: formData.nombre_usuario.trim().toLowerCase(),
          nombre_completo: formData.nombre_completo.trim(),
          rol_id: parseInt(formData.rol_id),
          correo: formData.correo.trim() || null,
        };
        await userService.crearUsuario(payload);
      }
      onSuccess();
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
            {editMode ? "Editar Usuario" : "Crear Nuevo Usuario"}
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
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="user-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            {editMode && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                <p className="font-bold text-slate-800">
                  {userToEdit.nombre_completo}
                </p>
                <p className="text-xs text-slate-500">
                  @{userToEdit.nombre_usuario}
                </p>
              </div>
            )}

            {!editMode && (
              <>
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
                  <input
                    type="text"
                    name="nombre_usuario"
                    value={formData.nombre_usuario}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="ej: maria.gomez"
                    className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.nombre_usuario ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
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
              </>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Rol de Sistema
              </label>
              <select
                name="rol_id"
                value={formData.rol_id}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={editandoPropioUsuario}
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${errors.rol_id ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              >
                <option value="">-- Selecciona un rol --</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.id} className="capitalize">
                    {rol.nombre}
                  </option>
                ))}
              </select>
              {editandoPropioUsuario ? (
                <p className="mt-1 text-xs text-slate-400">
                  No puedes cambiar tu propio rol.
                </p>
              ) : (
                errors.rol_id && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.rol_id}
                  </p>
                )
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Correo de Recuperación (opcional)
              </label>
              <input
                type="text"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="ej: maria.gomez@gmail.com"
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.correo ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              <p className="mt-1 text-xs text-slate-400">
                Habilita "olvidé mi contraseña" en el login para este
                usuario. Déjalo vacío si no tiene un correo real.
              </p>
              {errors.correo && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.correo}
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
            {isSubmitting
              ? "Guardando..."
              : editMode
                ? "Guardar Cambios"
                : "Guardar Usuario"}
          </button>
        </div>
      </div>
    </div>
  );
};
