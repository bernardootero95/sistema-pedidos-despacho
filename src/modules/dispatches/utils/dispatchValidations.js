// src/modules/dispatches/utils/dispatchValidations.js

/**
 * Diccionario de reglas de validación para la cabecera de la orden de
 * despacho (vehículo, conductor y fecha). Mismo patrón que
 * orderValidations.js: reglas puras, sin dependencia de UI.
 */
export const validators = {
  vehiculo_id: (value) => {
    if (!value) return "Debes seleccionar un vehículo.";
    return "";
  },

  repartidor_id: (value) => {
    if (!value) return "Debes asignar un conductor o repartidor.";
    return "";
  },

  fecha_despacho: (value) => {
    if (!value) return "La fecha de despacho es obligatoria.";
    return "";
  },
};

/**
 * Valida un único campo por nombre, usado para validación inmediata
 * onChange/onBlur (mismo patrón que validateOrderField).
 */
export const validateDispatchField = (name, value) => {
  const validator = validators[name];
  return validator ? validator(value) : "";
};

/**
 * Valida la cabecera completa del despacho antes de enviar.
 * @param {Object} formData - { vehiculo_id, repartidor_id, fecha_despacho, notas }
 * @returns {Object} Objeto con los errores encontrados. Si está vacío, no hay errores.
 */
export const validateDispatchForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validators[campo](formData[campo]);
    if (error) errors[campo] = error;
  });
  return errors;
};

/**
 * Valida que se haya asignado al menos un pedido a la ruta. Se maneja
 * aparte de validateDispatchForm porque no es un campo del formData sino
 * un array independiente (pedidosSeleccionadosIds).
 * @param {string[]} pedidosSeleccionadosIds
 * @returns {string} Mensaje de error, o "" si es válido
 */
export const validatePedidosSeleccionados = (pedidosSeleccionadosIds) => {
  if (!pedidosSeleccionadosIds || pedidosSeleccionadosIds.length === 0) {
    return "Debes asignar al menos un pedido a la ruta.";
  }
  return "";
};
