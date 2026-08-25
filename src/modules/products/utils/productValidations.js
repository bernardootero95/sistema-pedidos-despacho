/**
 * Diccionario de reglas de validación para el módulo de Productos.
 * Adaptado para sincronización externa (el tipo y categoría no bloquean la creación).
 */
const validators = {
  codigo: (value) => (!value.trim() ? "El código es obligatorio." : ""),
  nombre: (value) => (!value.trim() ? "El nombre es obligatorio." : ""),

  // La categoría pasa a ser opcional para no bloquear la sincronización
  // con el sistema de facturación externo.
  categoria_id: () => "",

  precio_venta: (value) => {
    if (value === "" || value === null) return "El precio es obligatorio.";
    if (Number(value) < 0) return "El precio no puede ser negativo.";
    return "";
  },

  iva: (value) => {
    if (value === "" || value === null)
      return "El IVA es obligatorio (ingresa 0 si no aplica).";
    if (Number(value) < 0) return "No puede ser negativo.";
    return "";
  },

  inc: (value) => {
    if (value === "" || value === null)
      return "El INC es obligatorio (ingresa 0 si no aplica).";
    if (Number(value) < 0) return "No puede ser negativo.";
    return "";
  },

  clasificacion: (value) =>
    !value ? "Selecciona una clasificación tributaria." : "",

  disponible: (value) => {
    if (value === "" || value === null)
      return "La cantidad disponible es obligatoria.";
    if (Number(value) < 0) return "La cantidad no puede ser negativa.";
    return "";
  },

  precio_frio: (value) => {
    if (value === "" || value === null || value === undefined) return ""; // Opcional
    if (Number(value) < 0) return "El precio no puede ser negativo.";
    return "";
  },

  precio_credito: (value) => {
    if (value === "" || value === null || value === undefined) return ""; // Opcional
    if (Number(value) < 0) return "El precio no puede ser negativo.";
    return "";
  },
};

/**
 * Valida una franja de precio al por mayor (cantidad_minima, precio),
 * ambos como strings de un <input>. Se usa por fila en el repeatable de
 * ProductForm, no por el diccionario `validators` genérico porque no
 * corresponde a un campo plano de `formData`.
 */
export const validateTierMayorista = (tier, otrasTiers = []) => {
  const errors = {};

  const cantidad = Number(tier.cantidad_minima);
  if (tier.cantidad_minima === "" || isNaN(cantidad) || cantidad <= 0) {
    errors.cantidad_minima = "Ingresa una cantidad mayor a 0.";
  } else if (
    otrasTiers.some((t) => Number(t.cantidad_minima) === cantidad)
  ) {
    errors.cantidad_minima = "Ya existe una franja con esa cantidad.";
  }

  const precio = Number(tier.precio);
  if (tier.precio === "" || isNaN(precio) || precio < 0) {
    errors.precio = "Ingresa un precio válido (0 o mayor).";
  }

  return errors;
};

/**
 * Función principal para validar un campo específico
 */
export const validateProductField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

/**
 * Función para validar todo el formulario antes del submit
 */
export const validateProductForm = (formData) => {
  const errors = {};
  Object.keys(formData).forEach((key) => {
    const error = validateProductField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};
