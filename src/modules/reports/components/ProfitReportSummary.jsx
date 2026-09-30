import { AlertTriangle, CircleCheckBig, Percent, TrendingUp, Wallet } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";
import { calcularMargen, formatMargen } from "../utils/profitReportFormat";

const Tarjeta = ({ icon: Icon, color, titulo, nota, valor, valorClassName = "text-slate-800" }) => (
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
    <p className={`text-2xl font-bold ${valorClassName}`}>{valor}</p>
  </div>
);

/**
 * Tarjetas del resumen del informe de utilidad y aviso de ventas sin costo.
 * Presentación pura: los montos vienen del RPC; acá solo se deriva el margen.
 */
export const ProfitReportSummary = ({ resumen }) => {
  const { ventas, ventasConCosto, costo, utilidad, pedidos, sinCosto } = resumen;
  const margen = calcularMargen(utilidad, ventasConCosto);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Tarjeta
          icon={CircleCheckBig}
          color="bg-blue-50 text-blue-600"
          titulo="Ventas"
          nota={`${pedidos} ${pedidos === 1 ? "pedido entregado" : "pedidos entregados"}`}
          valor={formatMoneda(ventas)}
        />
        <Tarjeta
          icon={Wallet}
          color="bg-amber-50 text-amber-600"
          titulo="Costo de lo vendido"
          nota="Costo de compra al momento del pedido"
          valor={formatMoneda(costo)}
        />
        <Tarjeta
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
          titulo="Utilidad bruta"
          nota="Ventas con costo − costo de lo vendido"
          valor={formatMoneda(utilidad)}
          valorClassName={utilidad < 0 ? "text-red-600" : "text-emerald-700"}
        />
        <Tarjeta
          icon={Percent}
          color="bg-violet-50 text-violet-600"
          titulo="Margen bruto"
          nota="Utilidad sobre ventas con costo"
          valor={formatMargen(margen)}
          valorClassName={margen !== null && margen < 0 ? "text-red-600" : "text-slate-800"}
        />
      </div>

      {sinCosto.monto > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            {formatMoneda(sinCosto.monto)} en ventas de {sinCosto.productos}{" "}
            {sinCosto.productos === 1 ? "producto" : "productos"} no tienen costo registrado y no se incluyen en la
            utilidad ni en el margen. Registra una compra de esos productos para que sus próximas ventas tengan costo.
          </p>
        </div>
      )}
    </div>
  );
};
