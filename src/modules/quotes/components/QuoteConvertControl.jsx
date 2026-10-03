import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { quoteService } from "../services/quoteService";

/**
 * Botón "Convertir en pedido" con segundo click de confirmación. Avisa que
 * el pedido toma los precios vigentes y descuenta stock, que es lo que
 * realmente hace crear_pedido_transaccional en el servidor.
 */
export const QuoteConvertControl = ({ cotizacionId, onConvertida }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const handleConvertir = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    setCargando(true);
    setError("");
    try {
      const resultado = await quoteService.convertirEnPedido(cotizacionId);
      onConvertida?.(resultado);
    } catch (err) {
      setError(err.message || "No se pudo convertir en pedido.");
      setConfirmando(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
      {confirmando && (
        <p className="text-xs text-slate-500 max-w-64 text-right">
          Se creará el pedido con los precios vigentes y se descontará el
          stock. Esta acción no se puede deshacer.
        </p>
      )}
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={handleConvertir}
          disabled={cargando}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary-hover"
        >
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {confirmando ? "Confirmar y crear pedido" : "Convertir en pedido"}
        </button>
        {confirmando && !cargando && (
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium max-w-64 text-right">{error}</p>}
    </div>
  );
};
