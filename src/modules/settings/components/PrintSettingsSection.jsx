import { FeatureToggleCard } from "./FeatureToggleCard";
import { useGuardarOpcion } from "../hooks/useGuardarOpcion";
import { Printer, Receipt, FileText, ImageIcon, Loader2 } from "lucide-react";

// impresion_carta_activo es booleano en la base; acá se presenta como una
// elección entre dos tamaños, que es como lo piensa el usuario.
const TAMANOS = [
  {
    carta: false,
    icon: Receipt,
    titulo: "Tirilla POS 80 mm",
    descripcion: "Impresora térmica de punto de venta.",
  },
  {
    carta: true,
    icon: FileText,
    titulo: "Hoja carta",
    descripcion: "Impresora convencional, formato documento.",
  },
];

/**
 * Tamaño de impresión de pedidos y facturas, y si se imprime el logo.
 */
export const PrintSettingsSection = () => {
  const { settings, guardando, guardarOpcion } = useGuardarOpcion();
  const guardandoTamano = guardando === "impresionCartaActivo";

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 flex items-center gap-2">
              Tamaño de impresión
              {guardandoTamano && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Aplica a pedidos y facturas electrónicas. Un pedido con factura
              electrónica vigente sale siempre como factura, con CUFE y QR.
            </p>
          </div>
        </div>

        <div role="radiogroup" aria-label="Tamaño de impresión" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TAMANOS.map(({ carta, icon: Icon, titulo, descripcion }) => {
            const seleccionado = settings.impresionCartaActivo === carta;
            return (
              <button
                key={titulo}
                type="button"
                role="radio"
                aria-checked={seleccionado}
                disabled={guardandoTamano}
                onClick={() => !seleccionado && guardarOpcion("impresionCartaActivo", carta)}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors disabled:opacity-60 ${
                  seleccionado
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${seleccionado ? "text-primary" : "text-slate-400"}`} />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{titulo}</span>
                  <span className="block text-xs text-slate-500">{descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <FeatureToggleCard
        icon={ImageIcon}
        titulo="Imprimir logo"
        descripcion="Incluye el logo de la empresa en pedidos y facturas, en tirilla y en carta. Si no hay un logo cargado, se imprimen sin logo."
        activo={settings.imprimirLogoActivo}
        guardando={guardando === "imprimirLogoActivo"}
        onToggle={() => guardarOpcion("imprimirLogoActivo", !settings.imprimirLogoActivo)}
      />
    </div>
  );
};
