/**
 * Roles con acceso a cada módulo del sistema. Única fuente de verdad:
 * la consumen tanto el sidebar (MainLayout, para ocultar ítems) como el
 * guard de rutas (RoleGuard, para bloquear la navegación directa por URL),
 * evitando que ambas listas se desincronicen con el tiempo.
 */
export const ROLES_MODULO = {
  DASHBOARD: ["soporte", "gerencia", "vendedor", "despachador", "repartidor", "cajera"],
  USUARIOS: ["soporte", "gerencia"],
  // El vendedor selecciona/crea clientes desde Nuevo Pedido (quick-add), no
  // necesita el directorio completo con edición/suspensión/eliminación.
  CLIENTES: ["soporte", "gerencia"],
  // vendedor sigue sin el catálogo completo (ve productos al armar un
  // pedido vía su propio fetch en OrderCreatePage, no gateado por este
  // permiso). despachador sí entra al catálogo completo: puede crear
  // productos y editar precios (RPC actualizar_precios_producto), pero no
  // stock/ficha completa ni eliminar — eso sigue siendo solo soporte/
  // gerencia (productos_write_admin).
  PRODUCTOS: ["soporte", "gerencia", "despachador"],
  // El despachador arma rutas con los vehículos vía su propio fetch en
  // DispatchCreatePage (no gateado por este permiso); no necesita el
  // listado/alta de vehículos.
  VEHICULOS: ["soporte", "gerencia"],
  PEDIDOS: ["soporte", "gerencia", "vendedor", "despachador", "cajera"],
  // repartidor ya no ve el listado/detalle de escritorio: tiene su propia
  // vista simplificada en MI_RUTA.
  DESPACHOS: ["soporte", "gerencia", "despachador"],
  MI_RUTA: ["repartidor"],
  INFORMES: ["soporte", "gerencia"],
  // Módulo de compras (alimenta inventario): mismos 3 roles operativos,
  // sin rol nuevo (acordado con el usuario).
  PROVEEDORES: ["soporte", "gerencia", "despachador"],
  COMPRAS: ["soporte", "gerencia", "despachador"],
};
