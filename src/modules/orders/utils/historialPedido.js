const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente",
  despachado: "Despachado (en ruta)",
  entregado: "Entregado",
  devuelto: "Devuelto",
  anulado: "Anulado",
};

const formatFecha = (fechaISO) =>
  new Date(fechaISO).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Traduce los registros crudos de `auditoria` (datos_anteriores/
 * datos_nuevos como snapshots completos de la fila) a eventos legibles
 * para el historial del pedido. Solo le interesan al usuario los cambios
 * de estado y de fecha de entrega; el resto de columnas auditadas
 * (actualizado, etc.) se ignoran para no meter ruido.
 */
export const construirEventosHistorial = (registros = []) => {
  const eventos = [];

  registros.forEach((registro) => {
    const {
      id,
      operacion,
      datos_anteriores: antes,
      datos_nuevos: despues,
      creado,
      usuarioNombre,
    } = registro;
    const usuario = usuarioNombre || "Sistema";

    if (operacion === "INSERT") {
      eventos.push({ id, fecha: creado, descripcion: `${usuario} creó el pedido.` });
      return;
    }

    if (!antes || !despues) return;

    const cambios = [];
    if (antes.estado !== despues.estado) {
      cambios.push(
        `el estado de "${ETIQUETAS_ESTADO[antes.estado] || antes.estado}" a "${
          ETIQUETAS_ESTADO[despues.estado] || despues.estado
        }"`,
      );
    }
    if (antes.fecha_entrega !== despues.fecha_entrega) {
      cambios.push(
        despues.fecha_entrega
          ? `la fecha de entrega a ${formatFecha(despues.fecha_entrega)}`
          : "la fecha de entrega (se limpió)",
      );
    }

    if (cambios.length === 0) return;

    eventos.push({
      id,
      fecha: creado,
      descripcion: `${usuario} actualizó ${cambios.join(" y ")}.`,
    });
  });

  return eventos;
};
