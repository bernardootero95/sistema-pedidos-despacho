import { CODIGOS_DIAN_MEDIO_PAGO } from "./dianPaymentCodes";

/**
 * Diccionario de reglas de validación del formulario de Métodos de Pago,
 * mismo patrón que clientValidations/priceTypeValidations: un validador por
 * campo con acceso al estado completo del formulario.
 */
const validators = {
  nombre: (value) => {
    const nombre = (value || "").trim();
    if (!nombre) return "El nombre es obligatorio.";
    if (nombre.length > 50) return "Máximo 50 caracteres.";
    return "";
  },

  codigo_dian: (value) =>
    CODIGOS_DIAN_MEDIO_PAGO.some((c) => c.codigo === value)
      ? ""
      : "Selecciona el código DIAN del medio de pago.",
};

export const validatePaymentMethodField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

export const validatePaymentMethodForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((key) => {
    const error = validatePaymentMethodField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
