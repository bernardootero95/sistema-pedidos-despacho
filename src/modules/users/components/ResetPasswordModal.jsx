import { useState } from "react";
import { userService } from "../services/userService";
import {
  validatePasswordField,
  validatePasswordForm,
} from "../../auth/utils/passwordValidations";
import { X, KeyRound, ShieldAlert } from "lucide-react";

/**
 * Reset de contraseña por un admin (gerencia/soporte), vía la Edge
 * Function reset-user-password. Funciona para cualquier usuario, tenga o
 * no correo real configurado — es el camino que siempre está disponible.
 */
export const ResetPasswordModal = ({ user, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };
    setFormData(nextFormData);
    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validatePasswordField(name, value, nextFormData),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validatePasswordField(name, value, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validatePasswordForm(formData);
    setTouched({ password: true, confirmPassword: true });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await userService.resetearPassword(user.id, formData.password);
      onSuccess();
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            Restablecer Contraseña
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-sm text-slate-600 mb-4">
            Vas a definir una contraseña nueva para{" "}
            <strong className="text-slate-900">{user.nombre_completo}</strong>{" "}
            (@{user.nombre_usuario}). Comunícasela directamente; el sistema
            no la envía por ningún canal.
          </p>

          {serverError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="reset-password-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Contraseña Nueva
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
                Confirmar Contraseña
              </label>
              <input
                type="text"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repite la contraseña"
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${errors.confirmPassword ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.confirmPassword}
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
            form="reset-password-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            {isSubmitting ? "Restableciendo..." : "Restablecer"}
          </button>
        </div>
      </div>
    </div>
  );
};
