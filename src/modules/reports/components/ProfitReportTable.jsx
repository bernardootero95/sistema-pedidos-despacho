import { AlertTriangle } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";
import { calcularMargen, formatCantidad, formatMargen } from "../utils/profitReportFormat";

/**
 * Utilidad por producto, con fila de totales al pie. Presentación pura:
 * recibe las filas ya calculadas por el RPC y el resumen para los totales
 * (no se vuelven a sumar en el cliente).
 */
export const ProfitReportTable = ({ detalle, resumen }) => {
  if (detalle.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
        No hay ventas entregadas en este mes.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
            <th className="p-4 whitespace-nowrap">Código</th>
            <th className="p-4">Producto</th>
            <th className="p-4 text-right">Cantidad</th>
            <th className="p-4 text-right">Ventas</th>
            <th className="p-4 text-right">Costo</th>
            <th className="p-4 text-right">Utilidad</th>
            <th className="p-4 text-right">Margen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {detalle.map((fila) => (
            <tr key={fila.productoId} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 text-slate-600">{fila.codigo}</td>
              <td className="p-4 font-medium text-slate-800">
                <span className="flex items-center gap-1.5">
                  {fila.nombre}
                  {fila.ventasSinCosto > 0 && (
                    <span title={`${formatMoneda(fila.ventasSinCosto)} vendidos sin costo registrado`}>
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-label="Ventas sin costo" />
                    </span>
                  )}
                </span>
              </td>
              <td className="p-4 text-right text-slate-700">{formatCantidad(fila.cantidad)}</td>
              <td className="p-4 text-right text-slate-700 whitespace-nowrap">{formatMoneda(fila.ventas)}</td>
              <td className="p-4 text-right text-slate-700 whitespace-nowrap">{formatMoneda(fila.costo)}</td>
              <td
                className={`p-4 text-right font-semibold whitespace-nowrap ${
                  fila.utilidad < 0 ? "text-red-600" : "text-slate-800"
                }`}
              >
                {formatMoneda(fila.utilidad)}
              </td>
              <td className="p-4 text-right text-slate-600 whitespace-nowrap">
                {formatMargen(calcularMargen(fila.utilidad, fila.ventasConCosto))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50 text-sm">
            <td className="p-4" colSpan={3}>
              Total
            </td>
            <td className="p-4 text-right whitespace-nowrap">{formatMoneda(resumen.ventas)}</td>
            <td className="p-4 text-right whitespace-nowrap">{formatMoneda(resumen.costo)}</td>
            <td className="p-4 text-right whitespace-nowrap">{formatMoneda(resumen.utilidad)}</td>
            <td className="p-4 text-right whitespace-nowrap">
              {formatMargen(calcularMargen(resumen.utilidad, resumen.ventasConCosto))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
