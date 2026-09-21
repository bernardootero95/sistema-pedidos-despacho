import { useState } from "react";
import { paymentMethodService } from "../services/paymentMethodService";
import {
  validatePaymentMethodField,
  validatePaymentMethodForm,
} from "../utils/paymentMethodValidations";
import { CODIGOS_DIAN_MEDIO_PAGO } from "../utils/dianPaymentCodes";
import { X, Save, ShieldAlert, CreditCard, Loader2 } from "lucide-react";

export const PaymentMethodForm = ({
  metodoToEdit = null,
  onSuccess,
  onCancel,
}) => {
  const isEditing = !!metodoToEdit;

  const [formData, setFormData] = useState({
    nombre: metodoToEdit?.nombre || "",
    codigo_dian: metodoToEdit?.codigo_dian || "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const actualizarCampo = (name, value) => {
    const nuevoEstado = { ...formData, [name]: value };
    setFormData(nuevoEstado);
    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validatePaymentMethodField(name, value, nuevoEstado),
      }));
    }
  };

  const marcarTocado = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validatePaymentMethodField(name, formData[name], formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validatePaymentMethodForm(formData);
    setTouched({ nombre: true, codigo_dian: true });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        codigo_dian: formData.codigo_dian,
      };
      if (isEditing) {
        await paymentMethodService.actualizarMetodoPago(
          metodoToEdit.id,
          payload,
        );
      } else {
        await paymentMethodService.crearMetodoPago(payload);
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? "Editar Método de Pago" : "Nuevo Método de Pago"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {serverError && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="payment-method-form"
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
          >
            <div>
              <label
                htmlFor="metodo-pago-nombre"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Nombre *
              </label>
              <input
                id="metodo-pago-nombre"
                type="text"
                maxLength={50}
                value={formData.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                onBlur={() => marcarTocado("nombre")}
                placeholder="Ej: Transferencia"
                className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.nombre ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              {errors.nombre && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.nombre}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="metodo-pago-dian"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Código DIAN *
              </label>
              <select
                id="metodo-pago-dian"
                value={formData.codigo_dian}
                onChange={(e) => actualizarCampo("codigo_dian", e.target.value)}
                onBlur={() => marcarTocado("codigo_dian")}
                className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.codigo_dian ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              >
                <option value="">Selecciona un medio de pago</option>
                {CODIGOS_DIAN_MEDIO_PAGO.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Es el medio de pago que se informa en la factura electrónica.
                Si un pedido se paga con varios métodos, se informa &quot;ZZZ&quot;.
              </p>
              {errors.codigo_dian && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.codigo_dian}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-end gap-3 shrink-0">
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
            form="payment-method-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};
