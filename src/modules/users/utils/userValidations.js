// src/modules/users/utils/userValidations.js
import { validatePasswordField } from "../../auth/utils/passwordValidations";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Diccionario de reglas de validación por campo, mismo patrón que
 * clientValidations.js / dispatchValidations.js.
 */
const validators = {
  nombre_completo: (value) =>
    !value.trim() ? "El nombre completo es obligatorio." : "",

  nombre_usuario: (value) => {
    if (!value.trim()) return "El nombre de usuario es obligatorio.";
    if (/\s/.test(value)) return "No debe contener espacios.";
    if (value.includes("@")) return "Ingresa solo el usuario, sin el dominio.";
    return "";
  },

  // La contraseña inicial que define el admin comparte la misma regla
  // mínima que cualquier contraseña nueva en el sistema.
  password: (value) => validatePasswordField("password", value),

  rol_id: (value) => (!value ? "Debes asignar un rol al usuario." : ""),

  // Opcional: si se deja vacío no hay error, solo se valida el formato
  // cuando el admin sí carga un correo.
  correo: (value) => {
    if (value && !EMAIL_REGEX.test(value)) return "Formato de correo inválido.";
    return "";
  },
};

export const validateUserField = (name, value) => {
  const validator = validators[name];
  return validator ? validator(value) : "";
};

/**
 * En modo edición (userToEdit presente) se puede modificar el correo y
 * el rol — usuario y contraseña no se tocan desde este formulario.
 */
export const validateUserForm = (formData, { editMode = false } = {}) => {
  const camposAValidar = editMode
    ? ["correo", "rol_id"]
    : ["nombre_completo", "nombre_usuario", "password", "rol_id", "correo"];

  const errors = {};
  camposAValidar.forEach((campo) => {
    const error = validateUserField(campo, formData[campo]);
    if (error) errors[campo] = error;
  });
  return errors;
};
