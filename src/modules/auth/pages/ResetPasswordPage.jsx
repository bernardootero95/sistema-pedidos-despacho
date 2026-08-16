import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../config/supabase";
import { authService } from "../services/authService";
import {
  validatePasswordForm,
  validatePasswordField,
} from "../utils/passwordValidations";
import { tenantConfig } from "../../../config/tenant";
import {
  Building2,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Loader2,
} from "lucide-react";

/**
 * Ruta pública a la que apunta el enlace de "olvidé mi contraseña"
 * (ver authService.solicitarRecuperacionPassword). Supabase procesa el
 * token de recuperación de la URL y establece una sesión temporal antes de
 * que este componente monte; solo falta pedir la contraseña nueva.
 */
export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValida, setSessionValida] = useState(false);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let activo = true;

    const verificarSesion = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (activo) {
        setSessionValida(Boolean(session));
        setCheckingSession(false);
      }
    };
    verificarSesion();

    // El evento PASSWORD_RECOVERY puede llegar después de este montaje si
    // Supabase todavía está procesando el token de la URL.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionValida(true);
        setCheckingSession(false);
      }
    });

    return () => {
      activo = false;
      subscription?.unsubscribe();
    };
  }, []);

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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 text-primary">
          <Building2 className="w-12 h-12" />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900">
          {tenantConfig.name}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Restablecer Contraseña
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10 border border-slate-200">
          {checkingSession ? (
            <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Verificando el enlace...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800">
                Tu contraseña se actualizó correctamente.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="mt-2 w-full py-3 px-4 rounded-xl sm:rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-all"
              >
                Ir a Iniciar Sesión
              </button>
            </div>
          ) : !sessionValida ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <ShieldAlert className="w-12 h-12 text-red-500" />
              <p className="text-sm font-semibold text-slate-800">
                Este enlace de recuperación no es válido o ya expiró.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="mt-2 w-full py-3 px-4 rounded-xl sm:rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-all"
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-center gap-3">
                  <ShieldAlert className="text-red-500 w-5 h-5 shrink-0" />
                  <p className="text-sm text-red-700 font-bold">
                    {serverError}
                  </p>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Contraseña Nueva
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
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

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Confirmar Contraseña
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`block w-full rounded-xl sm:rounded-lg border px-4 py-3.5 sm:py-2.5 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                        errors.confirmPassword
                          ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                          : "border-slate-300 focus:border-primary focus:ring-primary/20"
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1.5 text-xs text-red-600 font-bold">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center gap-2 py-3.5 sm:py-2.5 px-4 border border-transparent rounded-xl sm:rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-hover active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 min-h-12 sm:min-h-0"
                >
                  <KeyRound className="w-5 h-5 sm:w-4 sm:h-4" />
                  {isSubmitting ? "Guardando..." : "Guardar Nueva Contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
