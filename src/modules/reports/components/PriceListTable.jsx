import { formatMoneda } from "../utils/salesReportFormat";
import { formatEscalas } from "../utils/priceList";

/**
 * Lista de precios por producto: precio normal, una columna por tipo de
 * precio activo y las escalas al por mayor. Presentación pura: recibe las
 * filas ya filtradas y paginadas por la página.
 */
export const PriceListTable = ({ filas, tipos }) => {
  if (filas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
        No hay productos que coincidan con la búsqueda.
      </div>
    );
  }

  const conEscalas = filas.some((f) => f.escalas.length > 0);

  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
            <th className="p-4 whitespace-nowrap">Código</th>
            <th className="p-4">Producto</th>
            <th className="p-4">Categoría</th>
            <th className="p-4 text-right whitespace-nowrap">Precio de venta</th>
            {tipos.map((t) => (
              <th key={t.id} className="p-4 text-right whitespace-nowrap">
                {t.nombre}
              </th>
            ))}
            {conEscalas && <th className="p-4">Por mayor</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {filas.map((fila) => (
            <tr key={fila.productoId} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 text-slate-600">{fila.codigo}</td>
              <td className="p-4 font-medium text-slate-800 max-w-xs">
                <span className="block truncate" title={fila.nombre}>
                  {fila.nombre}
                </span>
              </td>
              <td className="p-4 text-slate-600">{fila.categoria || "—"}</td>
              <td className="p-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                {formatMoneda(fila.precioVenta)}
              </td>
              {tipos.map((t) => (
                <td key={t.id} className="p-4 text-right text-slate-700 whitespace-nowrap">
                  {fila.preciosTipo[t.id] == null ? "—" : formatMoneda(fila.preciosTipo[t.id])}
                </td>
              ))}
              {conEscalas && <td className="p-4 text-slate-600 text-xs">{formatEscalas(fila.escalas) || "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
