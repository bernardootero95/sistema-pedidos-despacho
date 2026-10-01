import { useState } from "react";
import { PackageCheck, Loader2 } from "lucide-react";
import { orderService } from "../services/orderService";
import { useSettings } from "../../../context/useSettings";
import { CobroEntregaModal } from "../../dispatches/components/CobroEntregaModal";
import { requiereCobroAlEntregar } from "../../dispatches/utils/cobroEntrega";

/**
 * Marca un pedido pendiente como entregado sin agregarlo a un despacho
 * (cliente que recoge, entrega sin ruta). Autónomo, mismo patrón que
 * FacturaIngefactControl: llama al servicio y avisa al padre vía
 * onEntregado para que recargue el pedido (pagos, fecha de entrega y la
 * factura automática cambian en el servidor).
 *
 * Con saldo por cobrar y la empresa usando métodos de pago o abonos, abre el
 * diálogo de cobro (mismo que en la ruta); si no, pide un segundo clic de
 * confirmación (ver DispatchStatusControl) porque entregar es irreversible
 * desde aquí.
 */
export const EntregarSinDespachoButton = ({ pedido, onEntregado }) => {
  const settings = useSettings();
  const [confirmando, setConfirmando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const entregar = async (pagos = null) => {
    await orderService.entregarSinDespacho(pedido.id, pagos);
    onEntregado?.();
  };

  const handleClick = async () => {
    if (requiereCobroAlEntregar(pedido, settings)) {
      setCobrando(true);
      return;
    }
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    setCargando(true);
    setError("");
    try {
      await entregar();
      setConfirmando(false);
    } catch (err) {
      setError(err.message || "No se pudo entregar el pedido.");
    } finally {
      setCargando(false);
    }
  };

  // PaymentModal muestra el error del servidor dentro del diálogo.
  const handleCobrar = async (pagos) => {
    await entregar(pagos);
    setCobrando(false);
  };

  return (
    <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={handleClick}
          disabled={cargando}
          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
            confirmando
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PackageCheck className="h-4 w-4" />
          )}
          {confirmando ? "Confirmar entrega" : "Marcar entregado"}
        </button>
        {confirmando && !cargando && (
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-2"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {cobrando && (
        <CobroEntregaModal
          pedido={pedido}
          onConfirm={handleCobrar}
          onCancel={() => setCobrando(false)}
        />
      )}
    </div>
  );
};
