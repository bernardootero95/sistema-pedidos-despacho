import { AlertTriangle, Boxes, PackageCheck, PackagePlus, ShoppingCart, Truck } from "lucide-react";
import { formatMoneda } from "../utils/salesReportFormat";
import { formatCantidad } from "../utils/profitReportFormat";

const Tarjeta = ({ icon: Icon, color, titulo, nota, cantidad, valor }) => (
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
    <p className="text-2xl font-bold text-slate-800">{formatMoneda(valor)}</p>
    <p className="text-xs text-slate-500">{formatCantidad(cantidad)} unidades</p>
  </div>
);

/**
 * Tarjetas con el valor del inventario del rango y aviso de productos sin
 * costo. Presentación pura: los totales vienen de resumirRango.
 */
export const InventoryReportSummary = ({ totales, sinCosto, base }) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <Tarjeta
        icon={Boxes}
        color="bg-slate-100 text-slate-600"
        titulo="Inicial"
        nota="Físico al comenzar el rango"
        {...totales.inicial}
      />
      <Tarjeta
        icon={PackagePlus}
        color="bg-blue-50 text-blue-600"
        titulo="Compras"
        nota="Compras registradas"
        {...totales.compras}
      />
      <Tarjeta
        icon={ShoppingCart}
        color="bg-emerald-50 text-emerald-600"
        titulo="Ventas"
        nota="Pedidos entregados"
        {...totales.ventas}
      />
      <Tarjeta
        icon={Truck}
        color="bg-amber-50 text-amber-600"
        titulo="Preventa"
        nota="Pedidos por entregar al cierre"
        {...totales.preventa}
      />
      <Tarjeta
        icon={PackageCheck}
        color="bg-violet-50 text-violet-600"
        titulo="Disponible"
        nota="Mercancía libre al cierre"
        {...totales.disponible}
      />
    </div>

    {base === "costo" && sinCosto > 0 && (
      <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          {sinCosto} {sinCosto === 1 ? "producto no tiene" : "productos no tienen"} costo registrado y valen $0 a precio
          de costo. Registra una compra o asigna el costo en el catálogo para valorarlos.
        </p>
      </div>
    )}
  </div>
);
