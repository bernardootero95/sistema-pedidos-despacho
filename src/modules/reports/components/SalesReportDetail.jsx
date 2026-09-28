import { useMemo, useState } from "react";
import { formatFechaHora, formatMoneda, etiquetaEstado } from "../utils/salesReportFormat";

/**
 * Detalle del informe de ventas: una pestaña por categoría (ventas,
 * anulados, devueltos, pendientes...) con la lista de pedidos. El
 * agrupado se deriva del arreglo `detalle` con useMemo (única fuente de
 * verdad), no se mantienen listas paralelas.
 */
export const SalesReportDetail = ({ detalle, categorias }) => {
  const [activa, setActiva] = useState(categorias[0].clave);

  const porCategoria = useMemo(() => {
    const grupos = Object.fromEntries(categorias.map((c) => [c.clave, []]));
    detalle.forEach((pedido) => grupos[pedido.categoria]?.push(pedido));
    return grupos;
  }, [detalle, categorias]);

  const pedidos = porCategoria[activa] || [];
  const total = pedidos.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col min-h-0">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pt-2" role="tablist">
        {categorias.map((categoria) => (
          <button
            key={categoria.clave}
            type="button"
            role="tab"
            aria-selected={activa === categoria.clave}
            onClick={() => setActiva(categoria.clave)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activa === categoria.clave
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {categoria.label}
            <span className="ml-1.5 text-xs rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">
              {porCategoria[categoria.clave].length}
            </span>
          </button>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No hay pedidos en esta categoría.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3 whitespace-nowrap">N° pedido</th>
                <th className="p-3 whitespace-nowrap">Fecha pedido</th>
                <th className="p-3 whitespace-nowrap">Fecha entrega</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800 whitespace-nowrap">{pedido.numero_pedido}</td>
                  <td className="p-3 text-slate-600 whitespace-nowrap">{formatFechaHora(pedido.fecha_pedido)}</td>
                  <td className="p-3 text-slate-600 whitespace-nowrap">{formatFechaHora(pedido.fecha_entrega)}</td>
                  <td className="p-3 text-slate-700">{pedido.cliente}</td>
                  <td className="p-3 text-slate-600">{pedido.vendedor || "—"}</td>
                  <td className="p-3 text-slate-600">{etiquetaEstado(pedido.estado)}</td>
                  <td className="p-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {formatMoneda(pedido.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50">
                <td className="p-3" colSpan={6}>
                  Total ({pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"})
                </td>
                <td className="p-3 text-right whitespace-nowrap">{formatMoneda(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
