// src/modules/clients/utils/clientValidations.js

/**
 * Diccionario de reglas de validación por campo.
 * Recibe el valor actual y el estado completo del formulario para validaciones condicionales.
 */
const validators = {
  numero_identificacion: (value) =>
    !value.trim() ? "El número de identificación es obligatorio." : "",
  tipo_identificacion: (value) => (!value ? "Selecciona un tipo." : ""),
  tipo_organizacion: (value) =>
    !value ? "Selecciona el tipo de organización." : "",
  direccion: (value) => (!value.trim() ? "La dirección es obligatoria." : ""),
  ciudad_municipio: (value) =>
    !value.trim() ? "La ciudad/municipio es obligatoria." : "",

  correo: (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Formato de correo inválido.";
    return "";
  },

  // Condicionales para Persona Natural
  primer_nombre: (value, formState) => {
    if (formState.tipo_organizacion === "natural" && !value.trim())
      return "El primer nombre es obligatorio.";
    return "";
  },
  primer_apellido: (value, formState) => {
    if (formState.tipo_organizacion === "natural" && !value.trim())
      return "El primer apellido es obligatorio.";
    return "";
  },

  // Condicionales para Persona Jurídica
  razon_social: (value, formState) => {
    if (formState.tipo_organizacion === "juridica" && !value.trim())
      return "La razón social es obligatoria.";
    return "";
  },
};

/**
 * Función principal para validar un campo específico
 */
export const validateClientField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

/**
 * Función para validar todo el formulario antes del submit
 */
export const validateClientForm = (formData) => {
  const errors = {};
  Object.keys(formData).forEach((key) => {
    const error = validateClientField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
