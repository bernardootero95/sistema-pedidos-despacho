import { ESTADOS_COTIZACION, estadoEfectivo } from "../utils/quoteStatus";

/** Etiqueta de estado de una cotización (incluye "Vencida", que se deriva de la fecha). */
export const QuoteStatusBadge = ({ cotizacion }) => {
  const estado = ESTADOS_COTIZACION[estadoEfectivo(cotizacion)];
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${estado.clases}`}
    >
      {estado.etiqueta}
    </span>
  );
};
