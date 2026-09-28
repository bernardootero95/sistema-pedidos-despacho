import { ClipboardList, CircleCheckBig, Ban, Clock } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";

const Linea = ({ label, dato }) => (
  <div className="flex justify-between gap-2 text-xs text-slate-600">
    <span>
      {label} <span className="text-slate-400">({dato.cantidad})</span>
    </span>
    <span className="font-medium text-slate-700 whitespace-nowrap">{formatMoneda(dato.monto)}</span>
  </div>
);

const Tarjeta = ({ icon: Icon, color, titulo, nota, cantidad, monto, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-700">{titulo}</p>
        <p className="text-[11px] text-slate-400">{nota}</p>
      </div>
    </div>
    <p className="text-2xl font-bold text-slate-800">{formatMoneda(monto)}</p>
    <p className="text-xs text-slate-500">
      {cantidad} {cantidad === 1 ? "pedido" : "pedidos"}
    </p>
    {children && <div className="border-t border-slate-100 pt-2 flex flex-col gap-1">{children}</div>}
  </div>
);

/**
 * Tarjetas del resumen del informe de ventas. Presentación pura: los
 * montos ya vienen calculados por el RPC; acá solo se suman los pares que
 * se muestran agrupados (anulados + devueltos, pendientes del período +
 * anteriores).
 */
export const SalesReportSummary = ({ resumen, categorias }) => {
  const label = (clave) => categorias.find((c) => c.resumen === clave)?.label;
  const { preventa, ventas, anulados, devueltos, pendientes_periodo, pendientes_anteriores } = resumen;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Tarjeta
        icon={ClipboardList}
        color="bg-blue-50 text-blue-600"
        titulo="Total pedidos (preventa)"
        nota="Todos los estados, por fecha del pedido"
        cantidad={preventa.cantidad}
        monto={preventa.monto}
      />
      <Tarjeta
        icon={CircleCheckBig}
        color="bg-emerald-50 text-emerald-600"
        titulo="Total ventas"
        nota="Pedidos entregados, por fecha de entrega"
        cantidad={ventas.cantidad}
        monto={ventas.monto}
      />
      <Tarjeta
        icon={Ban}
        color="bg-red-50 text-red-600"
        titulo="Devoluciones y anulaciones"
        nota="Por fecha del pedido"
        cantidad={anulados.cantidad + devueltos.cantidad}
        monto={anulados.monto + devueltos.monto}
      >
        <Linea label="Anulados" dato={anulados} />
        <Linea label="Devueltos" dato={devueltos} />
      </Tarjeta>
      <Tarjeta
        icon={Clock}
        color="bg-amber-50 text-amber-600"
        titulo="Pedidos pendientes"
        nota="Sin entregar a la fecha de consulta"
        cantidad={pendientes_periodo.cantidad + pendientes_anteriores.cantidad}
        monto={pendientes_periodo.monto + pendientes_anteriores.monto}
      >
        <Linea label={label("pendientes_periodo")} dato={pendientes_periodo} />
        <Linea label={label("pendientes_anteriores")} dato={pendientes_anteriores} />
      </Tarjeta>
    </div>
  );
};
