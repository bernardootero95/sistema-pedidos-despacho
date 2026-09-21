/**
 * Códigos DIAN de "medio de pago" más usados en facturación electrónica. Cada
 * método de pago del catálogo se asocia a uno; ese código es el que se envía a
 * IngeFact en la factura.
 */
export const CODIGOS_DIAN_MEDIO_PAGO = [
  { codigo: "10", etiqueta: "10 - Efectivo" },
  { codigo: "42", etiqueta: "42 - Consignación bancaria" },
  { codigo: "47", etiqueta: "47 - Transferencia débito bancaria" },
  { codigo: "48", etiqueta: "48 - Tarjeta crédito" },
  { codigo: "49", etiqueta: "49 - Tarjeta débito" },
  { codigo: "20", etiqueta: "20 - Cheque" },
  { codigo: "ZZZ", etiqueta: "ZZZ - Otro / acuerdo mutuo" },
];

export const CODIGO_DIAN_EFECTIVO = "10";
