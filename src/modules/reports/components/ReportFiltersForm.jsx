import { Search, X } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { ESTADOS_PEDIDO, CAMPOS_FECHA } from "../../orders/utils/orderConstants";

const inputClass = (hasError) =>
  `w-full px-3 py-2.5 border rounded-xl outline-none text-sm transition-all bg-white ${
    hasError
      ? "border-red-400 focus:ring-2 focus:ring-red-200"
      : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
  }`;

/**
 * Formulario de filtros del informe de productos. Componente de
 * presentación puro (SRP): recibe estado + handlers del padre
 * (ProductsReportPage), no conoce el service ni dispara la consulta por su
 * cuenta — solo notifica onSubmit cuando el usuario pide generar el
 * informe.
 */
export const ReportFiltersForm = ({
  filtros,
  errors,
  touched,
  onChange,
  onBlur,
  onSubmit,
  onLimpiar,
  vendedores,
  clientes,
  loading,
}) => {
  const opcionesVendedor = vendedores.map((v) => ({
    value: v.id,
    label: v.nombre_completo,
  }));
  const opcionesCliente = clientes.map((c) => ({
    value: c.id,
    label: c.razon_social || `${c.primer_nombre} ${c.primer_apellido}`.trim(),
    hint: c.numero_identificacion,
  }));

  const hayFiltrosOpcionalesActivos = Boolean(
    filtros.estado || filtros.vendedorId || filtros.clienteId,
  );

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Campo de fecha
          </label>
          <select
            name="campoFecha"
            value={filtros.campoFecha || "fecha_entrega"}
            onChange={(e) => onChange("campoFecha", e.target.value)}
            className={inputClass(false)}
          >
            {CAMPOS_FECHA.map((campo) => (
              <option key={campo.value} value={campo.value}>
                {campo.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Fecha desde
          </label>
          <input
            type="date"
            name="fechaDesde"
            value={filtros.fechaDesde || ""}
            onChange={(e) => onChange("fechaDesde", e.target.value)}
            onBlur={(e) => onBlur("fechaDesde", e.target.value)}
            className={inputClass(touched.fechaDesde && errors.fechaDesde)}
          />
          {touched.fechaDesde && errors.fechaDesde && (
            <p className="text-xs text-red-600 mt-1">{errors.fechaDesde}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Fecha hasta
          </label>
          <input
            type="date"
            name="fechaHasta"
            value={filtros.fechaHasta || ""}
            onChange={(e) => onChange("fechaHasta", e.target.value)}
            onBlur={(e) => onBlur("fechaHasta", e.target.value)}
            className={inputClass(touched.fechaHasta && errors.fechaHasta)}
          />
          {touched.fechaHasta && errors.fechaHasta && (
            <p className="text-xs text-red-600 mt-1">{errors.fechaHasta}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Estado del pedido
          </label>
          <select
            value={filtros.estado || ""}
            onChange={(e) => onChange("estado", e.target.value)}
            className={inputClass(false)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_PEDIDO.map((estado) => (
              <option key={estado} value={estado}>
                {estado.charAt(0).toUpperCase() + estado.slice(1).replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Vendedor
          </label>
          <SearchableSelect
            options={opcionesVendedor}
            value={filtros.vendedorId || ""}
            onChange={(value) => onChange("vendedorId", value)}
            placeholder="Todos los vendedores"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Cliente
          </label>
          <SearchableSelect
            options={opcionesCliente}
            value={filtros.clienteId || ""}
            onChange={(value) => onChange("clienteId", value)}
            placeholder="Todos los clientes"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Search className="h-4 w-4" />
          {loading ? "Generando..." : "Generar informe"}
        </button>

        {hayFiltrosOpcionalesActivos && (
          <button
            type="button"
            onClick={onLimpiar}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            <X className="h-4 w-4" /> Limpiar filtros
          </button>
        )}
      </div>
    </form>
  );
};
