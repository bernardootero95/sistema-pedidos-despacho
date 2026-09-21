import { Loader2 } from "lucide-react";

/**
 * Tarjeta con un interruptor para activar/desactivar una funcionalidad de la
 * empresa. Presentacional: el estado y el guardado los maneja la página.
 */
export const FeatureToggleCard = ({
  icon: Icon,
  titulo,
  descripcion,
  activo,
  guardando,
  onToggle,
}) => (
  <div className="flex items-start justify-between gap-4 p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-start gap-3 min-w-0">
      <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-slate-900">{titulo}</p>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {descripcion}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2 shrink-0 pt-1">
      {guardando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={titulo}
        disabled={guardando}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
          activo ? "bg-primary" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            activo ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  </div>
);
