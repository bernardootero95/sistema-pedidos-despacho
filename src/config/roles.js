/**
 * Roles con acceso a cada módulo del sistema. Única fuente de verdad:
 * la consumen tanto el sidebar (MainLayout, para ocultar ítems) como el
 * guard de rutas (RoleGuard, para bloquear la navegación directa por URL),
 * evitando que ambas listas se desincronicen con el tiempo.
 */
export const ROLES_MODULO = {
  DASHBOARD: ["soporte", "gerencia", "vendedor", "despachador", "repartidor"],
  USUARIOS: ["soporte", "gerencia"],
  CLIENTES: ["soporte", "gerencia", "vendedor"],
  PRODUCTOS: ["soporte", "gerencia", "vendedor", "despachador"],
  VEHICULOS: ["soporte", "gerencia", "despachador"],
  PEDIDOS: ["soporte", "gerencia", "vendedor", "despachador"],
  // repartidor ya no ve el listado/detalle de escritorio: tiene su propia
  // vista simplificada en MI_RUTA.
  DESPACHOS: ["soporte", "gerencia", "despachador"],
  MI_RUTA: ["repartidor"],
};
