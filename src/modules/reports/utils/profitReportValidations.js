// src/modules/reports/utils/profitReportValidations.js
import { mesLocalISO } from "./salesReportPeriod";

/**
 * Diccionario de reglas de validación para los filtros del informe de
 * utilidad. Mismo patrón que salesReportValidations.js.
 */
export const validators = {
  mes: (value) => {
    if (!value) return "El mes es obligatorio.";
    if (value > mesLocalISO()) return "El mes no puede ser futuro.";
    return "";
  },
};

/** Valida un único campo por nombre (validación inmediata onChange/onBlur). */
export const validateProfitReportField = (name, value, formData) => {
  const validator = validators[name];
  return validator ? validator(value, formData) : "";
};

/**
 * Valida el formulario completo antes de consultar el informe.
 * @param {Object} formData - { mes }
 * @returns {Object} Errores por campo; vacío si no hay errores.
 */
export const validateProfitReportFilters = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validators[campo](formData[campo], formData);
    if (error) errors[campo] = error;
  });
  return errors;
};
