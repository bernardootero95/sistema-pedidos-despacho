import { useState } from "react";
import { Loader2 } from "lucide-react";

const ESTILOS = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  outlineDanger: "border border-red-300 text-red-600 hover:bg-red-50",
};

/**
 * Botón de acción destructiva con confirmación explícita: el primer click
 * pide confirmar y el segundo ejecuta (mismo criterio que
 * DispatchStatusControl al anular). `advertencia` se muestra mientras se
 * espera la confirmación.
 */
export const ConfirmActionButton = ({
  icon: Icon,
  label,
  confirmLabel,
  advertencia,
  onConfirm,
  disabled,
  variant = "primary",
}) => {
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);

  const ejecutar = async () => {
    setEjecutando(true);
    try {
      await onConfirm();
    } finally {
      setEjecutando(false);
      setConfirmando(false);
    }
  };

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={disabled}
        className={`flex items-center gap-2 disabled:opacity-60 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${ESTILOS[variant]}`}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-xl border border-amber-200 bg-amber-50">
      {advertencia && <p className="text-xs text-amber-800 max-w-xs">{advertencia}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={ejecutar}
          disabled={ejecutando}
          className={`flex items-center gap-2 disabled:opacity-60 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${ESTILOS[variant === "outlineDanger" ? "danger" : variant]}`}
        >
          {ejecutando && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={ejecutando}
          className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Volver
        </button>
      </div>
    </div>
  );
};
