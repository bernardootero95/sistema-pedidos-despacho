import { AlertTriangle } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";
import { formatCantidad } from "../utils/profitReportFormat";
import { valoresBodega } from "../utils/inventoryValuation";

/**
 * Inventario de la bodega por producto. Presentación pura: recibe las filas
 * ya filtradas por la página.
 */
export const WarehouseInventoryTable = ({ filas }) => {
  if (filas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
        No hay productos con existencia en la bodega.
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
            <th className="p-4 text-right">Disponible</th>
            <th className="p-4 text-right">Pendiente</th>
            <th className="p-4 text-right">En bodega</th>
            <th className="p-4 text-right">Costo</th>
            <th className="p-4 text-right">Venta</th>
            <th className="p-4 text-right">Ganancia posible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {filas.map((fila) => {
            const v = valoresBodega(fila);
            const ganancia = v.gananciaDisponible + v.gananciaPendiente;
            return (
              <tr key={fila.productoId} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-600">{fila.codigo}</td>
                <td className="p-4 font-medium text-slate-800 max-w-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate" title={fila.nombre}>
                      {fila.nombre}
                    </span>
                    {!v.conCosto && (
                      <span title="Sin costo registrado">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-label="Sin costo" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-4 text-right text-slate-700">{formatCantidad(fila.disponible)}</td>
                <td className="p-4 text-right text-slate-700">{formatCantidad(fila.pendiente)}</td>
                <td className="p-4 text-right font-semibold text-slate-800">{formatCantidad(v.total)}</td>
                <td className="p-4 text-right text-slate-700 whitespace-nowrap">{formatMoneda(v.costoTotal)}</td>
                <td className="p-4 text-right text-slate-700 whitespace-nowrap">{formatMoneda(v.ventaTotal)}</td>
                <td
                  className={`p-4 text-right font-semibold whitespace-nowrap ${
                    ganancia < 0 ? "text-red-600" : "text-slate-800"
                  }`}
                >
                  {v.conCosto ? formatMoneda(ganancia) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
