import { formatMoneda } from "../utils/salesReportFormat";
import { formatCantidad } from "../utils/profitReportFormat";
import { COLUMNAS_RANGO, valorColumnaRango } from "../utils/inventoryValuation";

/**
 * Inventario por producto del rango, con totales de unidades y de valor al
 * pie. Presentación pura: cantidades del RPC, valoración con
 * inventoryValuation.
 */
export const InventoryReportTable = ({ filas, totales, base }) => {
  if (filas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
        No hay inventario ni movimientos en este rango.
      </div>
    );
  }

  const etiquetaValor = base === "costo" ? "costo" : "venta";

  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
            <th className="p-4 whitespace-nowrap">Código</th>
            <th className="p-4">Producto</th>
            {COLUMNAS_RANGO.map(({ clave, etiqueta }) => (
              <th key={clave} className="p-4 text-right">
                {etiqueta}
              </th>
            ))}
            <th className="p-4 text-right whitespace-nowrap">Valor disponible ({etiquetaValor})</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {filas.map((fila) => (
            <tr key={fila.productoId} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 text-slate-600">{fila.codigo}</td>
              <td className="p-4 font-medium text-slate-800">{fila.nombre}</td>
              {COLUMNAS_RANGO.map(({ clave }) => (
                <td key={clave} className="p-4 text-right text-slate-700">
                  {formatCantidad(fila[clave])}
                </td>
              ))}
              <td className="p-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                {formatMoneda(valorColumnaRango(fila, "disponible", base))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50 text-sm">
            <td className="p-4" colSpan={2}>
              Total unidades
            </td>
            {COLUMNAS_RANGO.map(({ clave }) => (
              <td key={clave} className="p-4 text-right">
                {formatCantidad(totales[clave].cantidad)}
              </td>
            ))}
            <td />
          </tr>
          <tr className="font-bold text-slate-800 bg-slate-50 text-sm">
            <td className="p-4" colSpan={2}>
              Valor a precio de {etiquetaValor}
            </td>
            {COLUMNAS_RANGO.map(({ clave }) => (
              <td key={clave} className="p-4 text-right whitespace-nowrap">
                {formatMoneda(totales[clave].valor)}
              </td>
            ))}
            <td className="p-4 text-right whitespace-nowrap">{formatMoneda(totales.disponible.valor)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
