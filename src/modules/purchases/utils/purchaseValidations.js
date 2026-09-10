// src/modules/purchases/utils/purchaseValidations.js

/**
 * Diccionario de validadores por campo de la cabecera de la compra, mismo
 * patrón que orderValidations.js.
 */
const validators = {
  proveedor_id: (value) => (!value ? "Selecciona un proveedor." : ""),
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
