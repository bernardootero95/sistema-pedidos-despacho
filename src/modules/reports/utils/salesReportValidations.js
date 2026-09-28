// src/modules/reports/utils/salesReportValidations.js
import { fechaLocalISO, mesLocalISO } from "./salesReportPeriod";

/**
 * Diccionario de reglas de validación para los filtros del informe de
 * ventas. Mismo patrón que reportFiltersValidations.js: reglas puras con
 * acceso al estado completo — acá para la regla condicional por `tipo`
 * (el día solo aplica al informe diario y el mes al cierre mensual).
 */
export const validators = {
  fecha: (value, formData) => {
    if (formData.tipo !== "diario") return "";
    if (!value) return "La fecha es obligatoria.";
    if (value > fechaLocalISO()) return "La fecha no puede ser futura.";
    return "";
  },

  mes: (value, formData) => {
    if (formData.tipo !== "mensual") return "";
    if (!value) return "El mes es obligatorio.";
    if (value > mesLocalISO()) return "El mes no puede ser futuro.";
    return "";
  },
};

/** Valida un único campo por nombre (validación inmediata onChange/onBlur). */
export const validateSalesReportField = (name, value, formData) => {
  const validator = validators[name];
  return validator ? validator(value, formData) : "";
};

/**
 * Valida el formulario completo antes de consultar el informe.
 * @param {Object} formData - { tipo, fecha, mes, vendedorId }
 * @returns {Object} Errores por campo; vacío si no hay errores.
 */
export const validateSalesReportFilters = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validators[campo](formData[campo], formData);
    if (error) errors[campo] = error;
  });
  return errors;
};
