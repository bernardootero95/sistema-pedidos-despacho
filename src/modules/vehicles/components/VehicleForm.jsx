import React, { useState } from "react";
import { vehicleService } from "../services/vehicleService";
import {
  validateVehicleField,
  validateVehicleForm,
} from "../utils/vehicleValidations";
import { X, Save, Truck, ShieldAlert, Loader2 } from "lucide-react";

export const VehicleForm = ({ onSuccess, onCancel, vehicleToEdit = null }) => {
  const isEditing = !!vehicleToEdit;

  const [formData, setFormData] = useState({
    placa: vehicleToEdit?.placa || "",
    marca: vehicleToEdit?.marca || "",
    modelo: vehicleToEdit?.modelo || "",
    capacidad_peso: vehicleToEdit?.capacidad_peso || "",
    capacidad_volumen: vehicleToEdit?.capacidad_volumen || "",
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Normalizar placa a mayúsculas de inmediato
    const finalValue = name === "placa" ? value.toUpperCase() : value;

    setFormData((prev) => ({ ...prev, [name]: finalValue }));

    // Validación inmediata si el campo ya fue tocado
    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateVehicleField(name, finalValue),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateVehicleField(name, value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const formErrors = validateVehicleForm(formData);
    setErrors(formErrors);
    setTouched({
      placa: true,
      marca: true,
      modelo: true,
      capacidad_peso: true,
      capacidad_volumen: true,
    });

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await vehicleService.actualizarVehiculo(vehicleToEdit.id, formData);
      } else {
        await vehicleService.crearVehiculo(formData);
      }
      onSuccess();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 my-8">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {isEditing ? "Editar Vehículo" : "Registrar Nuevo Vehículo"}
              </h3>
              <p className="text-xs text-slate-500">
                Complete la información de la flota de transporte.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Placa */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Placa / Identificador *
              </label>
              <input
                type="text"
                name="placa"
                value={formData.placa}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: ABC123"
                className={`w-full px-3 py-2 text-sm rounded-xl border uppercase tracking-wider font-semibold focus:outline-none transition-colors ${
                  touched.placa && errors.placa
                    ? "border-red-300 focus:border-red-500 bg-red-50/30"
                    : "border-slate-200 focus:border-blue-600"
                }`}
              />
              {touched.placa && errors.placa && (
                <span className="text-xs text-red-500 mt-1 block">
                  {errors.placa}
                </span>
              )}
            </div>

            {/* Marca */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Marca *
              </label>
              <input
                type="text"
                name="marca"
                value={formData.marca}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Chevrolet, Hino"
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none transition-colors ${
                  touched.marca && errors.marca
                    ? "border-red-300 focus:border-red-500 bg-red-50/30"
                    : "border-slate-200 focus:border-blue-600"
                }`}
              />
              {touched.marca && errors.marca && (
                <span className="text-xs text-red-500 mt-1 block">
                  {errors.marca}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Modelo (Año) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Modelo (Año) *
              </label>
              <input
                type="number"
                name="modelo"
                value={formData.modelo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: 2023"
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none transition-colors ${
                  touched.modelo && errors.modelo
                    ? "border-red-300 focus:border-red-500 bg-red-50/30"
                    : "border-slate-200 focus:border-blue-600"
                }`}
              />
              {touched.modelo && errors.modelo && (
                <span className="text-xs text-red-500 mt-1 block">
                  {errors.modelo}
                </span>
              )}
            </div>

            {/* Capacidad de Peso (kg) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cap. Peso (kg) *
              </label>
              <input
                type="number"
                step="0.01"
                name="capacidad_peso"
                value={formData.capacidad_peso}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: 3500"
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none transition-colors ${
                  touched.capacidad_peso && errors.capacidad_peso
                    ? "border-red-300 focus:border-red-500 bg-red-50/30"
                    : "border-slate-200 focus:border-blue-600"
                }`}
              />
              {touched.capacidad_peso && errors.capacidad_peso && (
                <span className="text-xs text-red-500 mt-1 block">
                  {errors.capacidad_peso}
                </span>
              )}
            </div>

            {/* Capacidad de Volumen (m3) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cap. Volumen (m³)
              </label>
              <input
                type="number"
                step="0.01"
                name="capacidad_volumen"
                value={formData.capacidad_volumen}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: 18.5"
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none transition-colors ${
                  touched.capacidad_volumen && errors.capacidad_volumen
                    ? "border-red-300 focus:border-red-500 bg-red-50/30"
                    : "border-slate-200 focus:border-blue-600"
                }`}
              />
              {touched.capacidad_volumen && errors.capacidad_volumen && (
                <span className="text-xs text-red-500 mt-1 block">
                  {errors.capacidad_volumen}
                </span>
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {isEditing ? "Actualizar Vehículo" : "Guardar Vehículo"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
