import { useState } from "react";
import { supplierService } from "../services/supplierService";
import {
  validateSupplierField,
  validateSupplierForm,
} from "../utils/supplierValidations";
import { X, Save, ShieldAlert, Truck } from "lucide-react";

export const SupplierForm = ({ onSuccess, onCancel, supplierToEdit = null }) => {
  const isEditing = !!supplierToEdit;

  const [formData, setFormData] = useState({
    numero_identificacion: supplierToEdit?.numero_identificacion || "",
    nombre_comercial: supplierToEdit?.nombre_comercial || "",
    contacto_nombre: supplierToEdit?.contacto_nombre || "",
    telefono: supplierToEdit?.telefono || "",
    correo: supplierToEdit?.correo || "",
    direccion: supplierToEdit?.direccion || "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateSupplierField(name, value, formData),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateSupplierField(name, value, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validateSupplierForm(formData);

    const allTouched = {};
    Object.keys(formData).forEach((key) => (allTouched[key] = true));
    setTouched(allTouched);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        numero_identificacion: formData.numero_identificacion.trim(),
        nombre_comercial: formData.nombre_comercial.trim(),
        contacto_nombre: formData.contacto_nombre.trim() || null,
        telefono: formData.telefono.trim() || null,
        correo: formData.correo.trim() || null,
        direccion: formData.direccion.trim() || null,
      };

      const proveedorGuardado = isEditing
        ? await supplierService.actualizarProveedor(supplierToEdit.id, payload)
        : await supplierService.crearProveedor(payload);

      onSuccess(proveedorGuardado);
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {isEditing ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Datos de identificación y contacto del proveedor.
            </p>
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
            id="supplier-form"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Número de Identificación *
                </label>
                <input
                  type="text"
                  name="numero_identificacion"
                  value={formData.numero_identificacion}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.numero_identificacion ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
                {errors.numero_identificacion && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.numero_identificacion}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  name="nombre_comercial"
                  value={formData.nombre_comercial}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.nombre_comercial ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
                {errors.nombre_comercial && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.nombre_comercial}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Persona de Contacto
              </label>
              <input
                type="text"
                name="contacto_nombre"
                value={formData.contacto_nombre}
                onChange={handleChange}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="ejemplo@correo.com"
                  className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.correo ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
                {errors.correo && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.correo}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Dirección
              </label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
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
            form="supplier-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Guardando..." : "Guardar Proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
};
