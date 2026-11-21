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
 * Roles con permiso para anular cualquier pedido, sin restricción de
 * estado ni de dueño — mismo criterio sin restricciones que usa
 * anular_pedido_transaccional en el servidor.
 */
const ROLES_ANULAR_SIN_RESTRICCION = ["gerencia", "soporte", "despachador"];

/**
 * Replica en el cliente la regla de permiso de `anular_pedido_transaccional`
 * (fuente de verdad real: el RPC la vuelve a validar en el servidor), para
 * ocultar la opción "Anular" a quien de todas formas el backend rechazaría.
 * gerencia/soporte/despachador pueden anular cualquier pedido; vendedor
 * solo el suyo propio y solo si sigue 'pendiente'.
 *
 * @param {{ estado: string, vendedor_id: string }} pedido
 * @param {{ id: string, rol: string }} user
 */
export const puedeAnularPedido = (pedido, user) => {
  if (!pedido || !user || pedido.estado === "anulado") return false;
  if (ROLES_ANULAR_SIN_RESTRICCION.includes(user.rol)) return true;
  return (
    user.rol === "vendedor" &&
    pedido.estado === "pendiente" &&
    pedido.vendedor_id === user.id
  );
};

const ROLES_ENTREGAR_SIN_DESPACHO = ["soporte", "gerencia", "despachador"];

/**
 * Replica en el cliente la regla de `entregar_pedido_sin_despacho` (la
 * fuente de verdad es el RPC): solo soporte/gerencia/despachador, y solo
 * pedidos 'pendiente' (uno 'despachado' se entrega desde su ruta).
 *
 * @param {{ estado: string }} pedido
 * @param {{ rol: string }} user
 */
export const puedeEntregarSinDespacho = (pedido, user) =>
  !!pedido &&
  !!user &&
  pedido.estado === "pendiente" &&
  ROLES_ENTREGAR_SIN_DESPACHO.includes(user.rol);

const ROLES_FECHA_PEDIDO_ANTERIOR = ["soporte", "gerencia"];

/**
 * Replica la regla de `crear_pedido_transaccional` (fuente de verdad): solo
 * soporte/gerencia pueden registrar un pedido con fecha de un día anterior.
 *
 * @param {{ rol: string }} user
 */
export const puedeCambiarFechaPedido = (user) =>
  !!user && ROLES_FECHA_PEDIDO_ANTERIOR.includes(user.rol);

/**
 * Fecha de hoy en hora local como "YYYY-MM-DD" (el formato de
 * <input type="date">). No usa toISOString(), que da el día en UTC y en la
 * noche de Colombia ya sería mañana.
 */
export const fechaHoyLocal = (ahora = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
};

/**
 * Convierte lo escrito en el campo de precio manual a número: acepta coma
 * decimal (como se escribe en Colombia). Devuelve NaN si no es un precio válido.
 */
export const parsePrecioManual = (texto) => {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(limpio) ? Number(limpio) : Number.NaN;
};

// Mismo tope que valida crear/editar_pedido_transaccional en el servidor.
const PRECIO_MANUAL_MAXIMO = 9999999999;

/**
 * Diccionario de reglas de validación para la Cabecera y el Detalle del Pedido.
 */
export const validators = {
  // --- VALIDACIÓN DEL PRECIO MANUAL DE UNA LÍNEA ---
  // 0 es válido (obsequio); el servidor aplica las mismas reglas.
  precioManual: (value) => {
    if (String(value ?? "").trim() === "") return "Escribe el precio.";
    const precio = parsePrecioManual(value);
    if (Number.isNaN(precio)) return "Digita un precio válido (hasta 2 decimales).";
    if (precio > PRECIO_MANUAL_MAXIMO) return "El precio es demasiado grande.";
    return "";
  },

  // --- VALIDACIONES DE CABECERA ---
  cliente_id: (value) => {
    if (!value) return "Debes seleccionar un cliente.";
    return "";
  },

  vendedor_id: (value) => {
    if (!value) return "El vendedor no está asignado.";
    return "";
  },

  // Días anteriores sin límite; nunca futura (el servidor valida igual).
  // Las fechas "YYYY-MM-DD" se comparan bien como texto.
  fecha_pedido: (value) => {
    if (!value) return "Selecciona la fecha del pedido.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      return "La fecha no es válida.";
    }
    if (value > fechaHoyLocal()) return "La fecha del pedido no puede ser posterior a hoy.";
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
 * @param {Object} cabeceraData - Datos de la cabecera (cliente_id, vendedor_id,
 *   notas y, solo si quien crea puede cambiarla, fecha_pedido)
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

  // Ausente = el perfil no elige fecha (el pedido queda con la de hoy).
  if (cabeceraData.fecha_pedido !== undefined) {
    const fechaError = validators.fecha_pedido(cabeceraData.fecha_pedido);
    if (fechaError) errors.fecha_pedido = fechaError;
  }

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
