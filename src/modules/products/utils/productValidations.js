/**
 * Diccionario de reglas de validación para el módulo de Productos.
 * Adaptado para sincronización externa (el tipo y categoría no bloquean la creación).
 */
// Largo máximo de cada campo de clasificación: el de su columna en
// `productos` (tipo VARCHAR(50), el resto VARCHAR(100)). Opcionales.
export const LONGITUD_MAXIMA_CLASIFICACION = {
  tipo: 50,
  departamento: 100,
  linea: 100,
  categoria: 100,
};

const validarClasificacion = (campo) => (value) => {
  const maximo = LONGITUD_MAXIMA_CLASIFICACION[campo];
  return (value ?? "").trim().length > maximo ? `Máximo ${maximo} caracteres.` : "";
};

const validators = {
  codigo: (value) => (!value.trim() ? "El código es obligatorio." : ""),

  tipo: validarClasificacion("tipo"),
  departamento: validarClasificacion("departamento"),
  linea: validarClasificacion("linea"),
  categoria: validarClasificacion("categoria"),
  nombre: (value) => (!value.trim() ? "El nombre es obligatorio." : ""),

  // La categoría pasa a ser opcional para no bloquear la sincronización
  // con el sistema de facturación externo.
  categoria_id: () => "",

  precio_venta: (value) => {
    if (value === "" || value === null) return "El precio es obligatorio.";
    if (Number(value) < 0) return "El precio no puede ser negativo.";
    return "";
  },

  // Opcional: vacío = no se toca el costo actual.
  costo: (value) => {
    if (value === "" || value === null) return "";
    if (isNaN(Number(value))) return "Ingresa un número válido.";
    if (Number(value) < 0) return "El costo no puede ser negativo.";
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
 * Valida el valor de un precio diferenciado (frío, crédito, etc.): opcional,
 * pero si viene debe ser un número no negativo. Se usa por cada tipo de
 * precio dinámico del catálogo, no por el diccionario `validators` porque
 * no corresponde a un campo fijo de `formData`.
 */
export const validatePrecioPersonalizado = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const precio = Number(value);
  if (isNaN(precio)) return "Ingresa un número válido.";
  if (precio < 0) return "El precio no puede ser negativo.";
  return "";
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
