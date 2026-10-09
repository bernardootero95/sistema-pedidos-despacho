import { ArrowDownCircle, ArrowUpCircle, ClipboardList, Scale } from "lucide-react";
import { formatMoneda } from "../../reports/utils/salesReportFormat";
import { formatCantidad } from "../../reports/utils/profitReportFormat";

const Tarjeta = ({ icon: Icon, color, titulo, valor, nota, valorClassName = "text-slate-800" }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
    </div>
    <p className={`text-2xl font-bold ${valorClassName}`}>{valor}</p>
    <p className="text-xs text-slate-500">{nota}</p>
  </div>
);

/**
 * Avance del conteo y efecto de las diferencias (faltantes y sobrantes) a
 * costo y a venta. Presentación pura: los totales vienen de resumirToma.
 */
export const PhysicalCountSummary = ({ resumen }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
    <Tarjeta
      icon={ClipboardList}
      color="bg-blue-50 text-blue-600"
      titulo="Avance"
      valor={`${resumen.contados} de ${resumen.productos}`}
      nota={`${resumen.sinContar} sin contar (no se modifican)`}
    />
    <Tarjeta
      icon={ArrowDownCircle}
      color="bg-red-50 text-red-600"
      titulo="Faltantes"
      valor={formatMoneda(resumen.faltanteCosto)}
      valorClassName={resumen.faltanteCosto > 0 ? "text-red-600" : "text-slate-800"}
      nota={`${formatCantidad(resumen.faltanteUnidades)} unidades a costo`}
    />
    <Tarjeta
      icon={ArrowUpCircle}
      color="bg-emerald-50 text-emerald-600"
      titulo="Sobrantes"
      valor={formatMoneda(resumen.sobranteCosto)}
      valorClassName={resumen.sobranteCosto > 0 ? "text-emerald-700" : "text-slate-800"}
      nota={`${formatCantidad(resumen.sobranteUnidades)} unidades a costo`}
    />
    <Tarjeta
      icon={Scale}
      color="bg-violet-50 text-violet-600"
      titulo="Efecto neto"
      valor={formatMoneda(resumen.netoCosto)}
      valorClassName={resumen.netoCosto < 0 ? "text-red-600" : "text-slate-800"}
      nota={`a costo · ${formatMoneda(resumen.netoVenta)} a precio de venta`}
    />
  </div>
);
