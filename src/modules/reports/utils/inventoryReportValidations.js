// src/modules/reports/utils/inventoryReportValidations.js
import { fechaLocalISO } from "./salesReportPeriod";

const MAX_DIAS_RANGO = 366;

const diasEntre = (desde, hasta) => (new Date(`${hasta}T00:00:00`) - new Date(`${desde}T00:00:00`)) / 86400000;

/**
 * Diccionario de reglas de validación para los filtros del informe de
 * inventario por rango. Mismo patrón que reportFiltersValidations.js; las
 * reglas replican las del RPC para dar feedback inmediato.
 */
export const validators = {
  fechaDesde: (value) => {
    if (!value) return "La fecha desde es obligatoria.";
    return "";
  },

  fechaHasta: (value, formData) => {
    if (!value) return "La fecha hasta es obligatoria.";
    if (value > fechaLocalISO()) return "La fecha hasta no puede ser futura.";
    if (formData.fechaDesde && value < formData.fechaDesde) {
      return "La fecha hasta no puede ser anterior a la fecha desde.";
    }
    if (formData.fechaDesde && diasEntre(formData.fechaDesde, value) > MAX_DIAS_RANGO) {
      return "El rango no puede superar un año.";
    }
    return "";
  },
};

/** Valida un único campo por nombre (validación inmediata onChange/onBlur). */
export const validateInventoryReportField = (name, value, formData) => {
  const validator = validators[name];
  return validator ? validator(value, formData) : "";
};

/**
 * Valida el formulario completo antes de consultar el informe.
 * @param {Object} formData - { fechaDesde, fechaHasta }
 * @returns {Object} Errores por campo; vacío si no hay errores.
 */
export const validateInventoryReportFilters = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validators[campo](formData[campo], formData);
    if (error) errors[campo] = error;
  });
  return errors;
};
