// src/modules/inventory/utils/physicalCountValidations.js
import { parseCantidadContada } from "./physicalCountCalc";

const MAX_CANTIDAD = 9999999999;

/**
 * Diccionario de reglas de validación del conteo físico. Mismo patrón que
 * clientValidations.js/dispatchValidations.js, pero sobre una colección: la
 * clave es el campo (`contado`) y el valor es lo digitado en esa fila.
 * Vacío es válido: significa "producto no contado".
 */
export const validators = {
  contado: (value) => {
    const cantidad = parseCantidadContada(value);
    if (cantidad === null) return "";
    if (Number.isNaN(cantidad)) return "Digita un número positivo.";
    if (cantidad > MAX_CANTIDAD) return "La cantidad es demasiado grande.";
    if (Math.round(cantidad * 100) / 100 !== cantidad) return "Máximo 2 decimales.";
    return "";
  },
};

/** Valida un único campo por nombre (validación inmediata onChange/onBlur). */
export const validatePhysicalCountField = (name, value, formData) => {
  const validator = validators[name];
  return validator ? validator(value, formData) : "";
};

/**
 * Valida todos los conteos digitados antes de guardar.
 * @param {Record<string, string>} digitados - productoId → texto digitado
 * @returns {Record<string, string>} Errores por productoId; vacío si no hay.
 */
export const validatePhysicalCountEntries = (digitados) => {
  const errors = {};
  Object.entries(digitados).forEach(([productoId, texto]) => {
    const error = validators.contado(texto);
    if (error) errors[productoId] = error;
  });
  return errors;
};
