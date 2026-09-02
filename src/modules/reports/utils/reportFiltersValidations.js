// src/modules/reports/utils/reportFiltersValidations.js

/**
 * Diccionario de reglas de validación para los filtros del informe de
 * productos. Mismo patrón que dispatchValidations.js/orderValidations.js:
 * reglas puras, sin dependencia de UI, con acceso al estado completo para
 * la regla condicional de fechaHasta.
 */
export const validators = {
  fechaDesde: (value) => {
    if (!value) return "La fecha desde es obligatoria.";
    return "";
  },

  fechaHasta: (value, formData) => {
    if (!value) return "La fecha hasta es obligatoria.";
    if (formData.fechaDesde && value < formData.fechaDesde) {
      return "La fecha hasta no puede ser anterior a la fecha desde.";
    }
    return "";
  },
};

/**
 * Valida un único campo por nombre, usado para validación inmediata
 * onChange/onBlur.
 */
export const validateReportField = (name, value, formData) => {
  const validator = validators[name];
  return validator ? validator(value, formData) : "";
};

/**
 * Valida el formulario completo de filtros antes de consultar el informe.
 * @param {Object} formData - { fechaDesde, fechaHasta, campoFecha, estado, vendedorId, clienteId }
 * @returns {Object} Objeto con los errores encontrados. Si está vacío, no hay errores.
 */
export const validateReportFilters = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validators[campo](formData[campo], formData);
    if (error) errors[campo] = error;
  });
  return errors;
};
