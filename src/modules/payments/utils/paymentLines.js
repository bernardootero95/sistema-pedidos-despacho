/**
 * Lógica pura de las "líneas de pago": cada pago de un pedido/compra es una
 * línea { método, monto }, y una operación puede repartirse en varias.
 * Mismo patrón que clientValidations: un diccionario de validadores por campo
 * más una validación del formulario completo (aquí, de todas las líneas).
 */

// Los montos manejan hasta 2 decimales; esta tolerancia evita falsos
// descuadres por punto flotante al sumar.
const TOLERANCIA = 0.005;

export const MODOS_PAGO = {
  // La suma debe igualar exactamente el objetivo (cobro del saldo al entregar).
  EXACTO: "exacto",
  // La suma debe ser mayor a 0 y no superar el objetivo (abonos).
  MAXIMO: "maximo",
  // Puede quedar en 0 (sin pago) y no superar el objetivo (compra a crédito).
  OPCIONAL: "opcional",
};

let secuencia = 0;

export const crearLinea = (monto = "") => ({
  key: `linea-${++secuencia}`,
  metodo_pago_id: "",
  monto: monto === "" ? "" : String(monto),
});

export const parseMonto = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return NaN;
  return Number(String(valor).replace(",", "."));
};

export const formatearMoneda = (monto) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(monto || 0);

const esLineaVacia = (linea) => linea.monto === "" && !linea.metodo_pago_id;

export const sumarLineas = (lineas) =>
  lineas.reduce((acc, linea) => {
    const monto = parseMonto(linea.monto);
    return acc + (monto > 0 ? monto : 0);
  }, 0);

const validators = {
  metodo_pago_id: (value, linea, contexto) => {
    if (!contexto.metodosActivo) return "";
    if (!value) return "Selecciona el método.";
    const repetido = contexto.lineas.some(
      (otra) => otra.key !== linea.key && otra.metodo_pago_id === value,
    );
    return repetido ? "Método repetido: suma los montos en una sola línea." : "";
  },

  monto: (value) => {
    if (value === "") return "Ingresa el monto.";
    const monto = parseMonto(value);
    if (!(monto > 0)) return "El monto debe ser mayor a 0.";
    return "";
  },
};

export const validarCampoLinea = (campo, linea, contexto) => {
  if (contexto.modo === MODOS_PAGO.OPCIONAL && esLineaVacia(linea)) return "";
  const validator = validators[campo];
  return validator ? validator(linea[campo], linea, contexto) : "";
};

const validarTotal = (lineas, { modo, objetivo }) => {
  const suma = sumarLineas(lineas);

  if (modo === MODOS_PAGO.EXACTO) {
    if (suma < objetivo - TOLERANCIA)
      return `Falta cubrir ${formatearMoneda(objetivo - suma)}.`;
    if (suma > objetivo + TOLERANCIA)
      return `Excede el saldo en ${formatearMoneda(suma - objetivo)}.`;
    return "";
  }

  if (suma > objetivo + TOLERANCIA)
    return `Excede el saldo en ${formatearMoneda(suma - objetivo)}.`;
  if (modo === MODOS_PAGO.MAXIMO && suma <= 0)
    return "Registra al menos un pago.";
  return "";
};

/**
 * Valida todas las líneas. Devuelve los errores por línea y campo, un error
 * general del total, y `valido` (sin ningún error).
 */
export const validarLineas = (lineas, contexto) => {
  const ctx = { ...contexto, lineas };
  const porLinea = {};

  lineas.forEach((linea) => {
    const errores = {};
    ["metodo_pago_id", "monto"].forEach((campo) => {
      const error = validarCampoLinea(campo, linea, ctx);
      if (error) errores[campo] = error;
    });
    if (Object.keys(errores).length > 0) porLinea[linea.key] = errores;
  });

  const general =
    Object.keys(porLinea).length === 0 ? validarTotal(lineas, ctx) : "";

  return { porLinea, general, valido: !general && !Object.keys(porLinea).length };
};

/**
 * Líneas -> payload de las RPC ([{ metodo_pago_id, monto }]). Sin métodos de
 * pago activos el método va vacío y el servidor lo resuelve a Efectivo.
 */
export const lineasAPayload = (lineas) =>
  lineas
    .filter((linea) => parseMonto(linea.monto) > 0)
    .map((linea) => ({
      metodo_pago_id: linea.metodo_pago_id || null,
      monto: parseMonto(linea.monto),
    }));
