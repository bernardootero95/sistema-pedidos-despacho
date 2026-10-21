import { useState } from "react";
import { invoiceFooterService } from "../services/invoiceFooterService";
import {
  MAX_MENSAJE_PIE,
  validateInvoiceFooterField,
  validateInvoiceFooterForm,
} from "../utils/invoiceFooterValidations";
import { X, Save, ShieldAlert, MessageSquareText, Loader2 } from "lucide-react";

export const InvoiceFooterForm = ({ pieToEdit = null, onSuccess, onCancel }) => {
  const isEditing = !!pieToEdit;

  const [formData, setFormData] = useState({
    mensaje: pieToEdit?.mensaje || "",
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
        [name]: validateInvoiceFooterField(name, value, nuevoEstado),
      }));
    }
  };

  const marcarTocado = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateInvoiceFooterField(name, formData[name], formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validateInvoiceFooterForm(formData);
    setTouched({ mensaje: true });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = { mensaje: formData.mensaje.trim() };
      if (isEditing) {
        await invoiceFooterService.actualizarPie(pieToEdit.id, payload);
      } else {
        await invoiceFooterService.crearPie(payload);
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
              <MessageSquareText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? "Editar Pie de Factura" : "Nuevo Pie de Factura"}
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
            id="invoice-footer-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <label
              htmlFor="pie-factura-mensaje"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Mensaje *
            </label>
            <textarea
              id="pie-factura-mensaje"
              rows={4}
              maxLength={MAX_MENSAJE_PIE}
              value={formData.mensaje}
              onChange={(e) => actualizarCampo("mensaje", e.target.value)}
              onBlur={() => marcarTocado("mensaje")}
              placeholder="Ej: ¡Este mes lleva 2 y paga 1 en productos seleccionados!"
              className={`w-full p-2.5 bg-white border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 ${errors.mensaje ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
            />
            <div className="mt-1 flex justify-between gap-2 text-xs">
              <span className="text-red-500 font-bold">{errors.mensaje}</span>
              <span className="text-slate-400 shrink-0">
                {formData.mensaje.length}/{MAX_MENSAJE_PIE}
              </span>
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
            form="invoice-footer-form"
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
