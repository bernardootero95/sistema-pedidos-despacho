import { useState } from "react";
import { priceTypeService } from "../services/priceTypeService";
import {
  validatePriceTypeField,
  validatePriceTypeForm,
} from "../utils/priceTypeValidations";
import { ROLES_MODULO } from "../../../config/roles";
import { X, Save, ShieldAlert, Tag, Loader2 } from "lucide-react";

// Solo los roles que arman pedidos pueden aplicar un tipo de precio.
const ROLES_ASIGNABLES = ROLES_MODULO.PEDIDOS;

const capitalizar = (rol) => rol.charAt(0).toUpperCase() + rol.slice(1);

export const PriceTypeForm = ({ tipoToEdit = null, onSuccess, onCancel }) => {
  const isEditing = !!tipoToEdit;

  const [formData, setFormData] = useState({
    nombre: tipoToEdit?.nombre || "",
    roles_permitidos: tipoToEdit?.roles_permitidos || [],
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
        [name]: validatePriceTypeField(name, value, nuevoEstado),
      }));
    }
  };

  const marcarTocado = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validatePriceTypeField(name, formData[name], formData),
    }));
  };

  const toggleRol = (rol) => {
    const roles = formData.roles_permitidos.includes(rol)
      ? formData.roles_permitidos.filter((r) => r !== rol)
      : [...formData.roles_permitidos, rol];
    setTouched((prev) => ({ ...prev, roles_permitidos: true }));
    setFormData({ ...formData, roles_permitidos: roles });
    setErrors((prev) => ({
      ...prev,
      roles_permitidos: validatePriceTypeField("roles_permitidos", roles, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validatePriceTypeForm(formData);
    setTouched({ nombre: true, roles_permitidos: true });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        roles_permitidos: formData.roles_permitidos,
      };
      if (isEditing) {
        await priceTypeService.actualizarTipoPrecio(tipoToEdit.id, payload);
      } else {
        await priceTypeService.crearTipoPrecio(payload);
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
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? "Editar Tipo de Precio" : "Nuevo Tipo de Precio"}
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
            id="price-type-form"
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
          >
            <div>
              <label
                htmlFor="tipo-precio-nombre"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Nombre *
              </label>
              <input
                id="tipo-precio-nombre"
                type="text"
                maxLength={50}
                value={formData.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                onBlur={() => marcarTocado("nombre")}
                placeholder="Ej: Distribuidor"
                className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.nombre ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
              />
              {errors.nombre && (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errors.nombre}
                </p>
              )}
            </div>

            <fieldset>
              <legend className="block text-xs font-bold text-slate-700 mb-1.5">
                Roles que pueden aplicarlo *
              </legend>
              <p className="text-xs text-slate-400 mb-2">
                Solo estos roles verán y podrán usar este precio al armar un
                pedido.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES_ASIGNABLES.map((rol) => {
                  const activo = formData.roles_permitidos.includes(rol);
                  return (
                    <label
                      key={rol}
                      className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm cursor-pointer transition-colors ${
                        activo
                          ? "border-primary bg-primary/5 text-slate-900 font-semibold"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => toggleRol(rol)}
                        className="w-4 h-4 accent-primary"
                      />
                      {capitalizar(rol)}
                    </label>
                  );
                })}
              </div>
              {errors.roles_permitidos && (
                <p className="mt-1.5 text-xs text-red-500 font-bold">
                  {errors.roles_permitidos}
                </p>
              )}
            </fieldset>
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
            form="price-type-form"
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
