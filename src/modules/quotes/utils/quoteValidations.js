import { validators as orderValidators } from "../../orders/utils/orderValidations";
import { hoyIso } from "./quoteStatus";

/**
 * Diccionario de validadores por campo de la cabecera de la cotización
 * (mismo patrón que orderValidations / purchaseValidations). El segundo
 * argumento es el estado completo del formulario, por si una regla depende
 * de otro campo.
 */
const validators = {
  cliente_id: (value) => orderValidators.cliente_id(value),
  fecha_vencimiento: (value) => {
    if (!value) return "La fecha de vencimiento es obligatoria.";
    if (value < hoyIso()) return "La fecha de vencimiento no puede ser anterior a hoy.";
    return "";
  },
};

export const validateQuoteField = (name, value, form = {}) => {
  const validator = validators[name];
  return validator ? validator(value, form) : "";
};

/**
 * Valida la cabecera y que el carrito sea válido. Las reglas de las líneas
 * (cantidad > 0, cuartos de unidad, precio) son las mismas de un pedido.
 */
export const validateQuoteForm = (cabeceraData, carrito) => {
  const errors = {};

  Object.keys(validators).forEach((key) => {
    const error = validateQuoteField(key, cabeceraData[key], cabeceraData);
    if (error) errors[key] = error;
  });

  const carritoError = orderValidators.carrito(carrito);
  if (carritoError) {
    errors.carrito = carritoError.replace("El pedido", "La cotización");
  }

  return errors;
};
