// src/modules/settings/utils/precioManualRoles.js

/**
 * Perfiles que pueden recibir el permiso de cambiar el precio al vender:
 * los que toman pedidos. Mismos valores que acepta el CHECK de
 * configuracion_sistema.precio_manual_roles en el servidor.
 */
export const ROLES_PRECIO_MANUAL = [
  { valor: "soporte", etiqueta: "Soporte" },
  { valor: "gerencia", etiqueta: "Gerencia" },
  { valor: "vendedor", etiqueta: "Vendedor" },
  { valor: "despachador", etiqueta: "Despachador" },
  { valor: "cajera", etiqueta: "Cajera" },
];

/**
 * Diccionario de reglas de validación de la lista de perfiles autorizados
 * (mismo patrón que el resto de validaciones del proyecto). Con la opción
 * activa debe quedar al menos un perfil: sin ninguno nadie podría usarla.
 */
export const validators = {
  roles: (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      return "Selecciona al menos un perfil, o desactiva la opción.";
    }
    const validos = ROLES_PRECIO_MANUAL.map((r) => r.valor);
    if (roles.some((rol) => !validos.includes(rol))) return "Hay un perfil no válido.";
    return "";
  },
};

/** Valida la lista de perfiles antes de guardarla. Devuelve el error o "". */
export const validatePrecioManualRoles = (roles) => validators.roles(roles);

/** Agrega o quita un perfil sin duplicar y respetando el orden del catálogo. */
export const alternarRol = (roles, rol) => {
  const siguiente = roles.includes(rol) ? roles.filter((r) => r !== rol) : [...roles, rol];
  return ROLES_PRECIO_MANUAL.map((r) => r.valor).filter((valor) => siguiente.includes(valor));
};
