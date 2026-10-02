/**
 * Validaciones de los datos de la empresa (encabezado de pedidos y
 * facturas). Mismo patrón que paymentMethodValidations: un validador por
 * campo con acceso al estado completo del formulario.
 */
const maximo = (value, limite) =>
  (value || "").trim().length > limite ? `Máximo ${limite} caracteres.` : "";

const validators = {
  razon_social: (value) =>
    !(value || "").trim() ? "La razón social es obligatoria." : maximo(value, 200),

  nombre_comercial: (value) => maximo(value, 200),

  nit: (value) => {
    const nit = (value || "").trim();
    if (!nit) return "";
    if (!/^\d{5,15}$/.test(nit)) return "Solo números, sin puntos ni dígito de verificación.";
    return "";
  },

  digito_verificacion: (value, formState) => {
    const dv = (value || "").trim();
    if (!dv) return "";
    if (!/^\d$/.test(dv)) return "Un solo dígito.";
    if (!(formState.nit || "").trim()) return "Ingresa primero el NIT.";
    return "";
  },

  direccion: (value) => maximo(value, 200),
  ciudad: (value) => maximo(value, 100),
  telefono: (value) => maximo(value, 50),

  correo: (value) => {
    const correo = (value || "").trim();
    if (!correo) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return "Correo inválido.";
    return maximo(correo, 150);
  },

  resolucion_facturacion: (value) => maximo(value, 500),
};

export const validateCompanyField = (name, value, formState) => {
  const validator = validators[name];
  return validator ? validator(value, formState) : "";
};

export const validateCompanyForm = (formData) => {
  const errors = {};
  Object.keys(validators).forEach((key) => {
    const error = validateCompanyField(key, formData[key], formData);
    if (error) errors[key] = error;
  });
  return errors;
};

const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"];
const MAXIMO_LOGO_BYTES = 1024 * 1024;

/** Mismas restricciones que el bucket `empresa` (ver la migración). */
export const validateLogo = (archivo) => {
  if (!archivo) return "Selecciona una imagen.";
  if (!TIPOS_LOGO.includes(archivo.type)) return "El logo debe ser PNG, JPG o WEBP.";
  if (archivo.size > MAXIMO_LOGO_BYTES) return "El logo no puede pesar más de 1 MB.";
  return "";
};
