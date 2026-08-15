/**
 * Nombre para mostrar de un cliente: razón social si es persona jurídica,
 * o nombre completo si es persona natural. Único punto de esta regla —
 * antes duplicada en cada módulo (orders, dispatches, dashboard) que
 * consume el registro `clientes` unido en sus propias consultas.
 */
export const getNombreCliente = (cliente) => {
  if (!cliente) return "";
  const nombreCompleto =
    `${cliente.primer_nombre || ""} ${cliente.primer_apellido || ""}`.trim();
  return cliente.razon_social || nombreCompleto;
};
