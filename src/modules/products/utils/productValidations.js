/**
 * Diccionario de reglas de validación para el módulo de Productos.
 */
const validators = {
  codigo: (value) => (!value.trim() ? "El código es obligatorio." : ""),
  nombre: (value) => (!value.trim() ? "El nombre es obligatorio." : ""),

  // Condicional: Obligatorio si tipo es inventario o servicio
  categoria_id: (value, formState) => {
    const tipoStr = (formState.tipo || "").toLowerCase().trim();
    if ((tipoStr === "inventario" || tipoStr === "servicio") && !value) {
      return "La categoría es obligatoria para inventario o servicios.";
    }
    return "";
  },

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
