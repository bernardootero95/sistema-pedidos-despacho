import { useState } from "react";
import { productService } from "../services/productService";
import { validateProductField } from "../utils/productValidations";
import { X, Save, ShieldAlert, DollarSign, Loader2 } from "lucide-react";

/**
 * Modal de edición restringida a precios (venta, frío, crédito). Pensado
 * para roles con acceso parcial al catálogo (despachador): a diferencia de
 * ProductForm no toca stock, código ni el resto de la ficha, ni en el
 * formulario ni en el backend (ver RPC actualizar_precios_producto).
 */
export const ProductPriceForm = ({ producto, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    precio_venta: producto.precio_venta ?? "",
    precio_frio: producto.precio_frio ?? "",
    precio_credito: producto.precio_credito ?? "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormState = { ...formData, [name]: value };
    setFormData(newFormState);

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateProductField(name, value, newFormState),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateProductField(name, value, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = {
      precio_venta: validateProductField("precio_venta", formData.precio_venta, formData),
      precio_frio: validateProductField("precio_frio", formData.precio_frio, formData),
      precio_credito: validateProductField(
        "precio_credito",
        formData.precio_credito,
        formData,
      ),
    };
    setTouched({ precio_venta: true, precio_frio: true, precio_credito: true });
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      await productService.actualizarPreciosProducto(producto.id, {
        precio_venta: parseFloat(formData.precio_venta),
        precio_frio:
          formData.precio_frio !== "" ? parseFloat(formData.precio_frio) : null,
        precio_credito:
          formData.precio_credito !== ""
            ? parseFloat(formData.precio_credito)
            : null,
      });
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
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Editar Precios
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {producto.codigo} - {producto.nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
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
            id="product-price-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Precio Venta (Base) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  name="precio_venta"
                  value={formData.precio_venta}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 ${errors.precio_venta ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
              </div>
              {errors.precio_venta && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.precio_venta}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Precio Frío (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="precio_frio"
                  value={formData.precio_frio}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.precio_frio ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
              </div>
              {errors.precio_frio && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.precio_frio}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Precio a Crédito (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="precio_credito"
                  value={formData.precio_credito}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.precio_credito ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
              </div>
              {errors.precio_credito && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.precio_credito}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
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
            form="product-price-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? "Guardando..." : "Guardar Precios"}
          </button>
        </div>
      </div>
    </div>
  );
};
