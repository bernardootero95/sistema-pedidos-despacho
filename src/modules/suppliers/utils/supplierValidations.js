// src/modules/suppliers/utils/supplierValidations.js

/**
 * Diccionario de reglas de validación por campo, mismo patrón que
 * clientValidations.js.
 */
const validators = {
  numero_identificacion: (value) =>
    !value.trim() ? "El número de identificación es obligatorio." : "",
  nombre_comercial: (value) =>
    !value.trim() ? "El nombre del proveedor es obligatorio." : "",

  correo: (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Formato de correo inválido.";
    return "";
  },
};

/**
 * Función principal para validar un campo específico
 */
export const validateSupplierField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

/**
 * Función para validar todo el formulario antes del submit
 */
export const validateSupplierForm = (formData) => {
  const errors = {};
  Object.keys(formData).forEach((key) => {
    const error = validateSupplierField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
