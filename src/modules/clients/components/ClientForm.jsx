import React, { useState } from "react";
import { clientService } from "../services/clientService";
import {
  validateClientField,
  validateClientForm,
} from "../utils/clientValidations";
import { X, Save, ShieldAlert, Building2, User } from "lucide-react";

export const ClientForm = ({ onSuccess, onCancel, clientToEdit = null }) => {
  const isEditing = !!clientToEdit;

  const [formData, setFormData] = useState({
    numero_identificacion: clientToEdit?.numero_identificacion || "",
    tipo_identificacion: clientToEdit?.tipo_identificacion || "",
    tipo_organizacion: clientToEdit?.tipo_organizacion || "natural",
    primer_nombre: clientToEdit?.primer_nombre || "",
    otros_nombres: clientToEdit?.otros_nombres || "",
    primer_apellido: clientToEdit?.primer_apellido || "",
    otros_apellidos: clientToEdit?.otros_apellidos || "",
    razon_social: clientToEdit?.razon_social || "",
    nombre_comercial: clientToEdit?.nombre_comercial || "",
    direccion: clientToEdit?.direccion || "",
    ciudad_municipio: clientToEdit?.ciudad_municipio || "",
    correo: clientToEdit?.correo || "",
    telefono: clientToEdit?.telefono || "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Si cambiamos el tipo de organización, reseteamos los errores para evitar bloqueos visuales
    if (name === "tipo_organizacion") {
      setErrors({});
    }

    const newFormState = { ...formData, [name]: value };
    setFormData(newFormState);

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateClientField(name, value, newFormState),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateClientField(name, value, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    // Delegamos la validación global al utility file
    const newErrors = validateClientForm(formData);

    // Marcar todos como tocados
    const allTouched = {};
    Object.keys(formData).forEach((key) => (allTouched[key] = true));
    setTouched(allTouched);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // Limpiar el payload: No enviar datos basura según el tipo de organización
      const isNatural = formData.tipo_organizacion === "natural";
      const payload = {
        numero_identificacion: formData.numero_identificacion.trim(),
        tipo_identificacion: formData.tipo_identificacion,
        tipo_organizacion: formData.tipo_organizacion,
        direccion: formData.direccion.trim(),
        ciudad_municipio: formData.ciudad_municipio.trim(),
        correo: formData.correo.trim() || null,
        telefono: formData.telefono.trim() || null,

        // Asignación condicional
        primer_nombre: isNatural ? formData.primer_nombre.trim() : null,
        otros_nombres: isNatural ? formData.otros_nombres.trim() : null,
        primer_apellido: isNatural ? formData.primer_apellido.trim() : null,
        otros_apellidos: isNatural ? formData.otros_apellidos.trim() : null,

        razon_social: !isNatural ? formData.razon_social.trim() : null,
        nombre_comercial: !isNatural ? formData.nombre_comercial.trim() : null,
      };

      if (isEditing) {
        await clientService.actualizarCliente(clientToEdit.id, payload);
      } else {
        await clientService.crearCliente(payload);
      }

      onSuccess();
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNatural = formData.tipo_organizacion === "natural";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[95vh]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? "Editar Cliente" : "Registrar Nuevo Cliente"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completa los datos de identificación y contacto.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {serverError && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="client-form"
            onSubmit={handleSubmit}
            className="space-y-6"
            noValidate
          >
            {/* SECCIÓN 1: TIPO DE ORGANIZACIÓN */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  handleChange({
                    target: { name: "tipo_organizacion", value: "natural" },
                  })
                }
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${isNatural ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300 text-slate-500"}`}
              >
                <User className="w-6 h-6 mb-2" />
                <span className="text-sm font-bold">Persona Natural</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleChange({
                    target: { name: "tipo_organizacion", value: "juridica" },
                  })
                }
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${!isNatural ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300 text-slate-500"}`}
              >
                <Building2 className="w-6 h-6 mb-2" />
                <span className="text-sm font-bold">Persona Jurídica</span>
              </button>
            </div>

            {/* SECCIÓN 2: IDENTIFICACIÓN */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Datos de Identificación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tipo de Identificación *
                  </label>
                  <select
                    name="tipo_identificacion"
                    value={formData.tipo_identificacion}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.tipo_identificacion ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  >
                    <option value="">Seleccione...</option>
                    {isNatural ? (
                      <>
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="PASAPORTE">Pasaporte</option>
                      </>
                    ) : (
                      <option value="NIT">NIT</option>
                    )}
                  </select>
                  {errors.tipo_identificacion && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.tipo_identificacion}
                    </p>
                  )}
                </div>

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
              </div>
            </div>

            {/* SECCIÓN 3: NOMBRES O RAZÓN SOCIAL */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isNatural ? "Nombres y Apellidos" : "Información Comercial"}
              </h3>

              {isNatural ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Primer Nombre *
                    </label>
                    <input
                      type="text"
                      name="primer_nombre"
                      value={formData.primer_nombre}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.primer_nombre ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                    />
                    {errors.primer_nombre && (
                      <p className="mt-1 text-xs text-red-500 font-bold">
                        {errors.primer_nombre}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Otros Nombres
                    </label>
                    <input
                      type="text"
                      name="otros_nombres"
                      value={formData.otros_nombres}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Primer Apellido *
                    </label>
                    <input
                      type="text"
                      name="primer_apellido"
                      value={formData.primer_apellido}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.primer_apellido ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                    />
                    {errors.primer_apellido && (
                      <p className="mt-1 text-xs text-red-500 font-bold">
                        {errors.primer_apellido}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Otros Apellidos
                    </label>
                    <input
                      type="text"
                      name="otros_apellidos"
                      value={formData.otros_apellidos}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      name="razon_social"
                      value={formData.razon_social}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.razon_social ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                    />
                    {errors.razon_social && (
                      <p className="mt-1 text-xs text-red-500 font-bold">
                        {errors.razon_social}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nombre Comercial
                    </label>
                    <input
                      type="text"
                      name="nombre_comercial"
                      value={formData.nombre_comercial}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 4: CONTACTO Y UBICACIÓN */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contacto y Ubicación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Dirección Completa *
                  </label>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.direccion ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.direccion && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.direccion}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ciudad / Municipio *
                  </label>
                  <input
                    type="text"
                    name="ciudad_municipio"
                    value={formData.ciudad_municipio}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.ciudad_municipio ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.ciudad_municipio && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.ciudad_municipio}
                    </p>
                  )}
                </div>
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
                <div className="sm:col-span-2">
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
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
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
            form="client-form"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Guardando..." : "Guardar Cliente"}
          </button>
        </div>
      </div>
    </div>
  );
};
