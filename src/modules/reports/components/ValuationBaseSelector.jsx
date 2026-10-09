import { BASES_VALOR } from "../utils/inventoryValuation";

/**
 * Selector de la base de valoración (precio de costo / precio de venta) de
 * los informes de inventario. Presentación pura.
 */
export const ValuationBaseSelector = ({ base, onChange }) => (
  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Valorar a">
    {BASES_VALOR.map((opcion) => (
      <button
        key={opcion.valor}
        type="button"
        onClick={() => onChange(opcion.valor)}
        aria-pressed={base === opcion.valor}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          base === opcion.valor ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        {opcion.etiqueta}
      </button>
    ))}
  </div>
);
