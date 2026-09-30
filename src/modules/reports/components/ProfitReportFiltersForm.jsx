import { Search } from "lucide-react";
import { mesLocalISO } from "../utils/salesReportPeriod";

/**
 * Filtros del informe de utilidad: solo el mes. Presentación pura: el
 * estado, la validación y la consulta los maneja ProfitReportPage.
 */
export const ProfitReportFiltersForm = ({ filtros, errors, touched, onChange, onBlur, onSubmit, loading }) => {
  const errorMes = touched.mes && errors.mes;

  return (
    <form onSubmit={onSubmit} className="bg-white p-4 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        <div>
          <label htmlFor="mes" className="block text-xs font-medium text-slate-600 mb-1">
            Mes
          </label>
          <input
            id="mes"
            type="month"
            max={mesLocalISO()}
            value={filtros.mes || ""}
            onChange={(e) => onChange("mes", e.target.value)}
            onBlur={(e) => onBlur("mes", e.target.value)}
            className={`w-full px-3 py-2.5 border rounded-xl outline-none text-sm transition-all bg-white ${
              errorMes
                ? "border-red-400 focus:ring-2 focus:ring-red-200"
                : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            }`}
          />
          {errorMes && <p className="text-xs text-red-600 mt-1">{errors.mes}</p>}
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
