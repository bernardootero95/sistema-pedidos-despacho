/**
 * Diccionario de reglas de validación del formulario de Tipos de Precio,
 * mismo patrón que clientValidations/dispatchValidations: un validador por
 * campo con acceso al estado completo del formulario.
 */
const validators = {
  nombre: (value) => {
    const nombre = (value || "").trim();
    if (!nombre) return "El nombre es obligatorio.";
    if (nombre.length > 50) return "Máximo 50 caracteres.";
    return "";
  },

  roles_permitidos: (value) =>
    !value || value.length === 0 ? "Selecciona al menos un rol." : "",
};

export const validatePriceTypeField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

export const validatePriceTypeForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((key) => {
    const error = validatePriceTypeField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
