export const MAX_MENSAJE_PIE = 300;

/**
 * Diccionario de reglas de validación del formulario de Pie de factura,
 * mismo patrón que paymentMethodValidations: un validador por campo con
 * acceso al estado completo del formulario.
 */
const validators = {
  mensaje: (value) => {
    const mensaje = (value || "").trim();
    if (!mensaje) return "El mensaje es obligatorio.";
    if (mensaje.length > MAX_MENSAJE_PIE)
      return `Máximo ${MAX_MENSAJE_PIE} caracteres.`;
    return "";
  },
};

export const validateInvoiceFooterField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

export const validateInvoiceFooterForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((key) => {
    const error = validateInvoiceFooterField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
