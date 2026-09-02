import { Loader2, PackageSearch } from "lucide-react";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

/**
 * Tabla de resultados del informe de productos, con fila de totales al
 * pie. Componente de presentación puro: solo recibe las filas ya
 * calculadas por el RPC (vía reportService), no hace ningún cálculo de
 * negocio.
 */
export const ReportResultsTable = ({ filas, loading, error, consultado }) => {
  const totalCantidad = filas.reduce((acc, f) => acc + f.cantidad_total, 0);
  const totalMonto = filas.reduce((acc, f) => acc + f.monto_total, 0);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 flex-1 bg-white border border-t-0 border-slate-200 rounded-b-xl">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        Generando informe...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 flex-1 bg-white border border-t-0 border-slate-200 rounded-b-xl">
        Error: {error}
      </div>
    );
  }

  if (!consultado) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2 flex-1 bg-white border border-t-0 border-slate-200 rounded-b-xl">
        <PackageSearch className="h-8 w-8" />
        Ajusta los filtros y genera el informe.
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 flex-1 bg-white border border-t-0 border-slate-200 rounded-b-xl">
        No se encontraron productos con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto flex-1 bg-white border border-t-0 border-slate-200 rounded-b-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
            <th className="p-4 whitespace-nowrap">Código</th>
            <th className="p-4">Producto</th>
            <th className="p-4 text-right">Cantidad</th>
            <th className="p-4 text-right">Valor total</th>
            <th className="p-4 text-right"># Pedidos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {filas.map((fila) => (
            <tr key={fila.producto_id} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 text-slate-600">{fila.codigo}</td>
              <td className="p-4 font-medium text-slate-800">{fila.nombre}</td>
              <td className="p-4 text-right text-slate-700">{fila.cantidad_total}</td>
              <td className="p-4 text-right font-semibold text-slate-800">
                {formatCurrency(fila.monto_total)}
              </td>
              <td className="p-4 text-right text-slate-600">{fila.pedidos_count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50">
            <td className="p-4" colSpan={2}>
              Total
            </td>
            <td className="p-4 text-right">{totalCantidad}</td>
            <td className="p-4 text-right">{formatCurrency(totalMonto)}</td>
            <td className="p-4"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
