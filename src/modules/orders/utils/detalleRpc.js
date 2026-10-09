// src/modules/orders/utils/detalleRpc.js

/**
 * Línea del carrito -> línea que reciben crear/editar_pedido_transaccional y
 * crear_cotizacion_transaccional. El precio solo viaja en las líneas de tipo
 * "manual" (el servidor lo acepta únicamente de los perfiles autorizados en
 * Pagos y Facturación); en las demás lo resuelve el servidor desde el catálogo.
 *
 * @param {{ producto_id: string, cantidad: number|string, tipo_precio?: string, tipo_precio_id?: string|null, precio_unitario?: number }} item
 */
export const armarDetalleRpc = (item) => ({
  producto_id: item.producto_id,
  cantidad: Number(item.cantidad),
  tipo_precio: item.tipo_precio || "normal",
  tipo_precio_id: item.tipo_precio_id ?? null,
  ...(item.tipo_precio === "manual" && {
    precio_manual: Number(item.precio_unitario),
  }),
});
