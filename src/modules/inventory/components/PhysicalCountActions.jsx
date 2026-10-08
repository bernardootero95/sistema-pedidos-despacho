import { CheckCheck, FileSpreadsheet, Loader2, Save, XCircle } from "lucide-react";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { PhysicalCountImportButton } from "./PhysicalCountImportButton";

/**
 * Acciones de una toma en curso: hoja de conteo, importación, guardado,
 * aplicación y cancelación. Presentación pura: la lógica vive en
 * usePhysicalCount y la página.
 */
export const PhysicalCountActions = ({
  lineas,
  pendientes,
  trabajando,
  hayContados,
  onExportar,
  onImportado,
  onErrorImportacion,
  onGuardar,
  onAplicar,
  onCancelar,
}) => (
  <div className="flex flex-wrap items-start gap-2">
    <button
      type="button"
      onClick={onExportar}
      className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <FileSpreadsheet className="h-4 w-4" />
      Hoja de conteo
    </button>

    <PhysicalCountImportButton
      productos={lineas}
      onImportado={onImportado}
      onError={onErrorImportacion}
      disabled={trabajando}
    />

    <button
      type="button"
      onClick={onGuardar}
      disabled={trabajando || pendientes === 0}
      className="flex items-center gap-2 border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Guardar conteo{pendientes > 0 ? ` (${pendientes})` : ""}
    </button>

    <ConfirmActionButton
      icon={CheckCheck}
      label="Aplicar toma"
      confirmLabel="Sí, ajustar inventario"
      advertencia="Esto cambia el inventario de los productos contados y no se puede deshacer."
      onConfirm={onAplicar}
      disabled={trabajando || (!hayContados && pendientes === 0)}
    />

    <ConfirmActionButton
      icon={XCircle}
      label="Cancelar toma"
      confirmLabel="Sí, cancelar"
      advertencia="Se descarta el conteo; el inventario no cambia."
      variant="outlineDanger"
      onConfirm={onCancelar}
      disabled={trabajando}
    />
  </div>
);
