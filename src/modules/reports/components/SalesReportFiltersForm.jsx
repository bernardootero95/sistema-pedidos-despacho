import { Search } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { TIPOS_INFORME_VENTAS, fechaLocalISO, mesLocalISO } from "../utils/salesReportPeriod";

const inputClass = (hasError) =>
  `w-full px-3 py-2.5 border rounded-xl outline-none text-sm transition-all bg-white ${
    hasError
      ? "border-red-400 focus:ring-2 focus:ring-red-200"
      : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
  }`;

/**
 * Filtros del informe de ventas: tipo (diario / cierre de mes), el día o el
 * mes según el tipo, y vendedor opcional. Presentación pura: el estado, la
 * validación y la consulta los maneja SalesReportPage.
 */
export const SalesReportFiltersForm = ({
  filtros,
  errors,
  touched,
  onChange,
  onBlur,
  onSubmit,
  vendedores,
  loading,
}) => {
  const opcionesVendedor = vendedores.map((v) => ({ value: v.id, label: v.nombre_completo }));
  const esMensual = filtros.tipo === "mensual";
  const campoPeriodo = esMensual ? "mes" : "fecha";
  const errorPeriodo = touched[campoPeriodo] && errors[campoPeriodo];

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        <div>
          <span className="block text-xs font-medium text-slate-600 mb-1">Tipo de informe</span>
          <div className="grid grid-cols-2 rounded-xl border border-slate-300 p-1 bg-slate-50">
            {TIPOS_INFORME_VENTAS.map((tipo) => (
              <button
                key={tipo.value}
                type="button"
                onClick={() => onChange("tipo", tipo.value)}
                aria-pressed={filtros.tipo === tipo.value}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtros.tipo === tipo.value
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={campoPeriodo} className="block text-xs font-medium text-slate-600 mb-1">
            {esMensual ? "Mes" : "Día"}
          </label>
          <input
            id={campoPeriodo}
            type={esMensual ? "month" : "date"}
            max={esMensual ? mesLocalISO() : fechaLocalISO()}
            value={filtros[campoPeriodo] || ""}
            onChange={(e) => onChange(campoPeriodo, e.target.value)}
            onBlur={(e) => onBlur(campoPeriodo, e.target.value)}
            className={inputClass(errorPeriodo)}
          />
          {errorPeriodo && <p className="text-xs text-red-600 mt-1">{errors[campoPeriodo]}</p>}
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <span className="block text-xs font-medium text-slate-600 mb-1">Vendedor</span>
          <SearchableSelect
            options={opcionesVendedor}
            value={filtros.vendedorId || ""}
            onChange={(value) => onChange("vendedorId", value)}
            placeholder="Todos los vendedores"
          />
        </div>

        <div className="lg:pt-5">
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
