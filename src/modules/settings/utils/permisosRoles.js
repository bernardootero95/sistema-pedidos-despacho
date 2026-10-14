// src/modules/settings/utils/permisosRoles.js

/**
 * Permisos por perfil configurables desde "Pagos y Facturación". Un permiso
 * es una lista de perfiles (configuracion_sistema.<permiso>_roles) y los
 * catálogos de abajo son los mismos valores que aceptan los CHECK de esas
 * columnas en el servidor.
 *
 * Soporte y gerencia SIEMPRE tienen todos los permisos: no se pueden quitar
 * (el servidor lo exige con un CHECK) y por eso se muestran fijos.
 */
export const ROLES_SIEMPRE = ["soporte", "gerencia"];

const SOPORTE = { valor: "soporte", etiqueta: "Soporte" };
const GERENCIA = { valor: "gerencia", etiqueta: "Gerencia" };
const VENDEDOR = { valor: "vendedor", etiqueta: "Vendedor" };
const DESPACHADOR = { valor: "despachador", etiqueta: "Despachador" };
const REPARTIDOR = { valor: "repartidor", etiqueta: "Repartidor" };
const CAJERA = { valor: "cajera", etiqueta: "Cajera" };

// Perfiles que toman pedidos.
export const ROLES_PRECIO_MANUAL = [SOPORTE, GERENCIA, VENDEDOR, DESPACHADOR, CAJERA];

// Perfiles que entregan pedidos o cobran al entregar.
export const ROLES_CREDITO = [SOPORTE, GERENCIA, DESPACHADOR, REPARTIDOR, CAJERA];

/**
 * Diccionario de reglas de validación de una lista de perfiles (mismo patrón
 * que el resto de validaciones del proyecto): solo perfiles del catálogo y
 * siempre con soporte y gerencia.
 */
export const validators = {
  roles: (roles, catalogo) => {
    if (!Array.isArray(roles)) return "Lista de perfiles no válida.";
    const validos = catalogo.map((r) => r.valor);
    if (roles.some((rol) => !validos.includes(rol))) return "Hay un perfil no válido.";
    if (!ROLES_SIEMPRE.every((rol) => roles.includes(rol))) {
      return "Soporte y gerencia siempre tienen este permiso.";
    }
    return "";
  },
};

/** Valida la lista de perfiles antes de guardarla. Devuelve el error o "". */
export const validatePermisoRoles = (roles, catalogo) => validators.roles(roles, catalogo);

/**
 * Agrega o quita un perfil sin duplicar y respetando el orden del catálogo.
 * Soporte y gerencia nunca se quitan.
 */
export const alternarRol = (roles, rol, catalogo) => {
  const siguiente =
    roles.includes(rol) && !ROLES_SIEMPRE.includes(rol)
      ? roles.filter((r) => r !== rol)
      : [...roles, rol];
  return catalogo
    .map((r) => r.valor)
    .filter((valor) => siguiente.includes(valor) || ROLES_SIEMPRE.includes(valor));
};
