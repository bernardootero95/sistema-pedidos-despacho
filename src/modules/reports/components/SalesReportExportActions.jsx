import { FileDown, FileSpreadsheet, Loader2, Receipt } from "lucide-react";

const ACCIONES = [
  { formato: "excel", label: "Excel", icon: FileSpreadsheet },
  { formato: "carta", label: "PDF carta", icon: FileDown },
  { formato: "tiquete", label: "Tiquete", icon: Receipt },
];

/**
 * Botones de exportación del informe de ventas. Solo notifica qué formato
 * se pidió; el armado del archivo lo decide la página.
 */
export const SalesReportExportActions = ({ onExportar, exportando }) => (
  <div className="flex flex-wrap items-center gap-2">
    {ACCIONES.map(({ formato, label, icon: Icon }) => (
      <button
        key={formato}
        type="button"
        onClick={() => onExportar(formato)}
        disabled={Boolean(exportando)}
        className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {exportando === formato ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        {label}
      </button>
    ))}
  </div>
);
