/**
 * Nombre legible del tipo de precio aplicado a una línea de pedido, o ""
 * si fue el precio normal (no hace falta destacarlo). Para "personalizado"
 * usa el nombre del catálogo que trae el detalle (join a tipos_precio), con
 * un genérico si por alguna razón no vino.
 */
export const etiquetaTipoPrecio = (detalle) => {
  if (detalle?.tipo_precio === "mayorista") return "Mayorista";
  if (detalle?.tipo_precio === "personalizado") {
    return detalle.tipo?.nombre || "Precio especial";
  }
  return "";
};
