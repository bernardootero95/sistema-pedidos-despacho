// src/modules/orders/utils/orderValidations.js

// El negocio solo maneja cuartos de unidad (media caja, cuarto de caja,
// etc.), no cualquier decimal — mismo límite que aplica
// crear/editar_pedido_transaccional en el servidor (fuente de verdad).
const INCREMENTO_CANTIDAD = 0.25;

/**
 * true si `cantidad` es un múltiplo exacto de INCREMENTO_CANTIDAD (.25,
 * .5, .75 o entero). Se compara en centavos (enteros) en vez de dividir
 * decimales para no toparse con errores de precisión de punto flotante
 * (ej. 0.1 + 0.2 !== 0.3).
 */
export const esFraccionValida = (cantidad) => {
  const centavos = Math.round(Number(cantidad) * 100);
  return centavos % (INCREMENTO_CANTIDAD * 100) === 0;
};

/**
 * Redondea `cantidad` al múltiplo de INCREMENTO_CANTIDAD más cercano, para
 * corregir en el input lo que el usuario haya escrito (ej. "1.3" -> 1.25).
 */
export const redondearACantidadValida = (cantidad) => {
  const centavos = Math.round(Number(cantidad) * 100);
  const paso = INCREMENTO_CANTIDAD * 100;
  return (Math.round(centavos / paso) * paso) / 100;
};

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
      if (!esFraccionValida(item.cantidad)) {
        return `La cantidad de "${item.nombre || "Desconocido"}" debe ser un número entero o con fracción .25, .5 o .75.`;
      }
      if (Number(item.precio_unitario) < 0) {
        return `El precio del producto "${item.nombre || "Desconocido"}" es inválido.`;
      }
    }
    return "";
  },
};

/**
 * Valida un único campo por nombre (patrón consistente con
 * dispatchValidations.validateDispatchField), usado para validación
 * inmediata onBlur/onChange en el formulario.
 */
export const validateOrderField = (name, value) => {
  const validator = validators[name];
  return validator ? validator(value) : "";
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

// --- VALIDACIONES DE STOCK (puras, sin dependencia de UI ni de alert()) ---

/**
 * Valida si un producto puede agregarse al carrito por primera vez o
 * incrementarse una unidad más, contra su stock disponible.
 * @param {Object} producto - { nombre, disponible }
 * @param {number} cantidadEnCarrito - Cantidad que ya tiene el producto en el carrito (0 si aún no está)
 * @returns {string} Mensaje de error, o "" si es válido
 */
export const validarStockParaAgregar = (producto, cantidadEnCarrito = 0) => {
  if (producto.disponible <= 0) {
    return `El producto "${producto.nombre}" no tiene existencias disponibles.`;
  }
  if (cantidadEnCarrito + 1 > producto.disponible) {
    return `No puedes agregar más unidades de "${producto.nombre}". Stock disponible: ${producto.disponible}.`;
  }
  return "";
};

/**
 * Valida una cantidad deseada (por botones +/- o por input directo) contra
 * el stock disponible de la línea del carrito.
 * @param {number} cantidadDeseada
 * @param {number} disponible
 * @param {string} nombreProducto
 * @returns {string} Mensaje de error, o "" si es válido
 */
export const validarStockParaCantidad = (
  cantidadDeseada,
  disponible,
  nombreProducto = "este producto",
) => {
  if (cantidadDeseada > disponible) {
    return `Stock máximo alcanzado para "${nombreProducto}" (${disponible} unidades disponibles).`;
  }
  return "";
};
