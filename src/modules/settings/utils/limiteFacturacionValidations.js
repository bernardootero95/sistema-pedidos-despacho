export const TIPOS_LIMITE_FACTURACION = [
  { valor: "ilimitada", etiqueta: "Ilimitada", detalle: "Se envían a la DIAN todas las facturas." },
  { valor: "mensual", etiqueta: "Límite mensual", detalle: "Hasta que lo facturado en el mes llegue al valor." },
  { valor: "diaria", etiqueta: "Límite diario", detalle: "Hasta que lo facturado en el día llegue al valor." },
];

// Tope razonable para NUMERIC(14,2) y para evitar errores de digitación.
const VALOR_MAXIMO = 999_999_999_999;

/**
 * Diccionario de validadores del formulario de límite de facturación, mismo
 * patrón que clientValidations/paymentMethodValidations: un validador por
 * campo con acceso al estado completo (el valor solo aplica si hay límite).
 */
const validators = {
  tipo: (value) =>
    TIPOS_LIMITE_FACTURACION.some((t) => t.valor === value)
      ? ""
      : "Selecciona el tipo de límite.",

  valor: (value, formState) => {
    if (formState?.tipo === "ilimitada") return "";
    const texto = String(value ?? "").trim();
    if (!texto) return "El valor del límite es obligatorio.";
    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero <= 0) return "Ingresa un valor mayor a 0.";
    if (numero > VALOR_MAXIMO) return "El valor es demasiado grande.";
    return "";
  },
};

export const validateLimiteFacturacionField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

export const validateLimiteFacturacionForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((key) => {
    const error = validateLimiteFacturacionField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
