// src/modules/orders/utils/orderValidations.js

/**
 * Diccionario de reglas de validación para la Cabecera y el Detalle del Pedido.
 */
export const validators = {
  // --- VALIDACIONES DE CABECERA ---
  cliente_id: (value) => {
    if (!value) return "Debes seleccionar un cliente.";
    return "";
  },

  vendedor_id: (value) => {
    if (!value) return "El vendedor no está asignado.";
    return "";
  },

  // --- VALIDACIONES DE DETALLE (Carrito de compras) ---
  carrito: (carritoArray) => {
    if (!carritoArray || carritoArray.length === 0) {
      return "El pedido debe contener al menos un producto.";
    }

    // Validar que ninguna línea del carrito tenga errores de cantidad
    for (let i = 0; i < carritoArray.length; i++) {
      const item = carritoArray[i];
      if (!item.producto_id) {
        return `El ítem en la posición ${i + 1} no tiene un producto válido.`;
      }
      if (Number(item.cantidad) <= 0) {
        return `El producto "${item.nombre || "Desconocido"}" debe tener una cantidad mayor a 0.`;
      }
      if (Number(item.precio_unitario) < 0) {
        return `El precio del producto "${item.nombre || "Desconocido"}" es inválido.`;
      }
    }
    return "";
  },
};

/**
 * Función para validar todo el formulario de creación de pedidos antes de enviar
 * @param {Object} cabeceraData - Datos de la cabecera (cliente_id, vendedor_id, notas)
 * @param {Array} carritoData - Array de productos agregados al pedido
 * @returns {Object} Objeto con los errores encontrados. Si está vacío, no hay errores.
 */
export const validateOrderForm = (cabeceraData, carritoData) => {
  const errors = {};

  // Validar campos de cabecera
  const clienteError = validators.cliente_id(cabeceraData.cliente_id);
  if (clienteError) errors.cliente_id = clienteError;

  const vendedorError = validators.vendedor_id(cabeceraData.vendedor_id);
  if (vendedorError) errors.vendedor_id = vendedorError;

  // Validar carrito
  const carritoError = validators.carrito(carritoData);
  if (carritoError) errors.carrito = carritoError;

  return errors;
};
