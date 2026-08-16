import { useState } from "react";
import { authService } from "../services/authService";
import {
  validatePasswordField,
  validatePasswordForm,
} from "../utils/passwordValidations";
import { X, KeyRound, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Self-service: el usuario ya tiene sesión activa, así que
 * authService.actualizarPassword no necesita la contraseña actual —
 * supabase.auth.updateUser solo exige una sesión válida.
 */
export const ChangePasswordModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

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
      await authService.actualizarPassword(formData.password);
      setSuccess(true);
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
            Cambiar mi Contraseña
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">
              Tu contraseña se actualizó correctamente.
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 px-4 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-all"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-5">
              {serverError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{serverError}</p>
                </div>
              )}

              <form
                id="change-password-form"
                onSubmit={handleSubmit}
                className="space-y-4"
                noValidate
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Contraseña Nueva
                  </label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
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
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
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
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="change-password-form"
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
              >
                <KeyRound className="w-4 h-4" />
                {isSubmitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
