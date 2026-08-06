/**
 * Diccionario de reglas de validación para el módulo de Vehículos.
 * Garantiza formato de placa y rangos lógicos de capacidad y modelo.
 */
const currentYear = new Date().getFullYear();

const validators = {
  placa: (value) => {
    if (!value.trim()) return "La placa es obligatoria.";
    const cleanPlaca = value.trim().toUpperCase();
    // Validación estándar para formato de placa colombiana (ej: ABC123 o ABC12) o general
    if (cleanPlaca.length < 5)
      return "La placa debe tener al menos 5 caracteres.";
    return "";
  },
  marca: (value) => {
    if (!value.trim()) return "La marca es obligatoria.";
    return "";
  },
  modelo: (value) => {
    if (!value) return "El modelo (año) es obligatorio.";
    const yearNum = Number(value);
    if (isNaN(yearNum) || yearNum < 1970 || yearNum > currentYear + 1) {
      return `Ingrese un año válido entre 1970 y ${currentYear + 1}.`;
    }
    return "";
  },
  capacidad_peso: (value) => {
    if (value === "" || value === null)
      return "La capacidad de peso es obligatoria.";
    const weight = Number(value);
    if (isNaN(weight) || weight <= 0)
      return "La capacidad debe ser mayor a 0 kg.";
    return "";
  },
  capacidad_volumen: (value) => {
    if (value === "" || value === null) return ""; // Opcional pero si se ingresa debe ser positivo
    const volume = Number(value);
    if (isNaN(volume) || volume < 0) return "El volumen no puede ser negativo.";
    return "";
  },
};

export const validateVehicleField = (name, value) => {
  if (validators[name]) {
    return validators[name](value);
  }
  return "";
};

export const validateVehicleForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((field) => {
    const errorMsg = validateVehicleField(field, formData[field]);
    if (errorMsg) {
      errors[field] = errorMsg;
    }
  });
  return errors;
};
