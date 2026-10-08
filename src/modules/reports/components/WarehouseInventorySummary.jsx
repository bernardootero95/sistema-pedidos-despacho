import { AlertTriangle } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";
import { formatCantidad } from "../utils/profitReportFormat";

const Fila = ({ titulo, unidades, costo, venta, ganancia, destacada = false }) => (
  <tr className={destacada ? "border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800" : "text-slate-700"}>
    <td className="p-3 font-medium">{titulo}</td>
    <td className="p-3 text-right">{formatCantidad(unidades)}</td>
    <td className="p-3 text-right whitespace-nowrap">{formatMoneda(costo)}</td>
    <td className="p-3 text-right whitespace-nowrap">{formatMoneda(venta)}</td>
    <td className={`p-3 text-right whitespace-nowrap ${ganancia < 0 ? "text-red-600" : ""}`}>
      {formatMoneda(ganancia)}
    </td>
  </tr>
);

/**
 * Cuadro de la bodega: disponible, pendiente por entregar y total, con
 * unidades, costo, venta y ganancia posible. Presentación pura: los totales
 * vienen de resumirBodega.
 */
export const WarehouseInventorySummary = ({ resumen }) => (
  <div className="flex flex-col gap-3">
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <th className="p-3">Mercancía</th>
            <th className="p-3 text-right">Unidades</th>
            <th className="p-3 text-right">Valor a costo</th>
            <th className="p-3 text-right">Valor a venta</th>
            <th className="p-3 text-right">Ganancia posible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          <Fila
            titulo="Disponible"
            unidades={resumen.disponible}
            costo={resumen.costoDisponible}
            venta={resumen.ventaDisponible}
            ganancia={resumen.gananciaDisponible}
          />
          <Fila
            titulo="Pendiente por entregar"
            unidades={resumen.pendiente}
            costo={resumen.costoPendiente}
            venta={resumen.ventaPendiente}
            ganancia={resumen.gananciaPendiente}
          />
          <Fila
            titulo="Total en bodega"
            unidades={resumen.total}
            costo={resumen.costoTotal}
            venta={resumen.ventaTotal}
            ganancia={resumen.gananciaTotal}
            destacada
          />
        </tbody>
      </table>
    </div>

    {resumen.productosSinCosto > 0 && (
      <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          {resumen.productosSinCosto} {resumen.productosSinCosto === 1 ? "producto no tiene" : "productos no tienen"}{" "}
          costo registrado ({formatMoneda(resumen.ventaSinCosto)} a venta): valen $0 a costo y no se incluyen en la
          ganancia posible.
        </p>
      </div>
    )}
  </div>
);
