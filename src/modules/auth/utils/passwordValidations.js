// src/modules/auth/utils/passwordValidations.js

/**
 * Reglas compartidas por todo formulario que fija una contraseña nueva:
 * el modal de "cambiar mi contraseña" (self-service), la página de
 * restablecimiento tras el enlace de recuperación, y el campo de
 * contraseña del alta de usuario en UserForm.
 */
const MIN_LENGTH = 6;

const validators = {
  password: (value) => {
    if (!value) return "La contraseña es obligatoria.";
    if (value.length < MIN_LENGTH)
      return `Debe tener al menos ${MIN_LENGTH} caracteres.`;
    return "";
  },

  confirmPassword: (value, formState = {}) => {
    if (!value) return "Confirma la contraseña.";
    if (value !== formState.password) return "Las contraseñas no coinciden.";
    return "";
  },
};

export const validatePasswordField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

/**
 * Valida un formulario de { password, confirmPassword }.
 */
export const validatePasswordForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((campo) => {
    const error = validatePasswordField(campo, formData[campo], formData);
    if (error) errors[campo] = error;
  });
  return errors;
};
