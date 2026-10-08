import { Search } from "lucide-react";
import { fechaLocalISO } from "../utils/salesReportPeriod";

const claseInput = (hayError) =>
  `w-full px-3 py-2.5 border rounded-xl outline-none text-sm transition-all bg-white ${
    hayError
      ? "border-red-400 focus:ring-2 focus:ring-red-200"
      : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
  }`;

/**
 * Filtros del informe de inventario por rango: fecha desde y hasta.
 * Presentación pura: el estado, la validación y la consulta los maneja
 * InventoryReportPage.
 */
export const InventoryReportFiltersForm = ({ filtros, errors, touched, onChange, onBlur, onSubmit, loading }) => {
  const errorDesde = touched.fechaDesde && errors.fechaDesde;
  const errorHasta = touched.fechaHasta && errors.fechaHasta;

  return (
    <form onSubmit={onSubmit} className="bg-white p-4 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        <div>
          <label htmlFor="fechaDesde" className="block text-xs font-medium text-slate-600 mb-1">
            Desde
          </label>
          <input
            id="fechaDesde"
            type="date"
            max={fechaLocalISO()}
            value={filtros.fechaDesde || ""}
            onChange={(e) => onChange("fechaDesde", e.target.value)}
            onBlur={(e) => onBlur("fechaDesde", e.target.value)}
            className={claseInput(errorDesde)}
          />
          {errorDesde && <p className="text-xs text-red-600 mt-1">{errors.fechaDesde}</p>}
        </div>

        <div>
          <label htmlFor="fechaHasta" className="block text-xs font-medium text-slate-600 mb-1">
            Hasta
          </label>
          <input
            id="fechaHasta"
            type="date"
            max={fechaLocalISO()}
            value={filtros.fechaHasta || ""}
            onChange={(e) => onChange("fechaHasta", e.target.value)}
            onBlur={(e) => onBlur("fechaHasta", e.target.value)}
            className={claseInput(errorHasta)}
          />
          {errorHasta && <p className="text-xs text-red-600 mt-1">{errors.fechaHasta}</p>}
        </div>

        <div className="sm:pt-5">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Search className="h-4 w-4" />
            {loading ? "Generando..." : "Generar informe"}
          </button>
        </div>
      </div>
    </form>
  );
};
