import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    className: "bg-emerald-50 border-emerald-200 text-emerald-800",
    iconClassName: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    className: "bg-red-50 border-red-200 text-red-800",
    iconClassName: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-amber-50 border-amber-200 text-amber-800",
    iconClassName: "text-amber-500",
  },
  info: {
    icon: Info,
    className: "bg-blue-50 border-blue-200 text-blue-800",
    iconClassName: "text-blue-500",
  },
};

export const Toast = ({ message, type = "info", onClose }) => {
  const variant = VARIANTS[type] || VARIANTS.info;
  const Icon = variant.icon;

  return (
    <div
      role="alert"
      className={`animate-toast-enter flex items-start gap-3 w-full p-4 rounded-xl border shadow-lg ${variant.className}`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${variant.iconClassName}`} />
      <p className="flex-1 text-sm font-medium leading-snug break-words">
        {message}
      </p>
      <button
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
