// src/modules/purchases/utils/purchaseValidations.js
import { ESTADOS_RECEPCION, fechaIsoDe, hoyIso } from "./purchaseReception";

/**
 * Diccionario de validadores por campo de la cabecera de la compra, mismo
 * patrón que orderValidations.js.
 */
const validators = {
  proveedor_id: (value) => (!value ? "Selecciona un proveedor." : ""),
  fecha_compra: (value) => {
    if (!value) return "La fecha de la compra es obligatoria.";
    if (value > hoyIso()) return "La fecha de la compra no puede ser futura.";
    return "";
  },
  estado_recepcion: (value) =>
    Object.values(ESTADOS_RECEPCION).includes(value)
      ? ""
      : "Indica si la compra ya fue recibida o está pendiente.",
};

export const validatePurchaseField = (name, value) => {
  const validator = validators[name];
  return validator ? validator(value) : "";
};

/**
 * Valida la cabecera y que el carrito tenga al menos una línea.
 */
export const validatePurchaseForm = (cabeceraData, carrito) => {
  const errors = {};

  Object.keys(cabeceraData).forEach((key) => {
    const error = validatePurchaseField(key, cabeceraData[key]);
    if (error) errors[key] = error;
  });

  if (!carrito || carrito.length === 0) {
    errors.carrito = "Agrega al menos un producto a la compra.";
  }

  return errors;
};

/**
 * Fecha de recepción al marcar una compra pendiente como recibida: obligatoria,
 * no futura ni anterior a la fecha de la compra (el servidor valida lo mismo).
 *
 * @param {string} fecha YYYY-MM-DD elegida
 * @param {string} fechaCompra timestamp de la compra
 * @param {string} [hoy] YYYY-MM-DD de hoy (inyectable para tests)
 */
export const validateFechaRecepcion = (fecha, fechaCompra, hoy = hoyIso()) => {
  if (!fecha) return "La fecha de recepción es obligatoria.";
  if (fecha > hoy) return "La fecha de recepción no puede ser futura.";
  const minima = fechaIsoDe(fechaCompra);
  if (minima && fecha < minima)
    return "La fecha de recepción no puede ser anterior a la fecha de la compra.";
  return "";
};
