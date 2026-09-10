import { useState } from "react";
import { Loader2, Ban } from "lucide-react";
import { purchaseService } from "../services/purchaseService";

/**
 * Botón "Anular Compra" con segundo click de confirmación — mismo patrón
 * que DispatchStatusControl (variant="buttons"), pero acá la única
 * transición posible es 'registrada' -> 'anulada', así que no hace falta
 * un mapa de transiciones ni variantes de badge/menú.
 */
export const PurchaseAnularControl = ({ compraId, estado, onAnulada }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  if (estado === "anulada") return null;

  const handleAnular = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    if (!motivo.trim()) {
      setError("Indica un motivo para anular la compra.");
      return;
    }

    setCargando(true);
    setError("");
    try {
      const resultado = await purchaseService.anularCompraTransaccional(
        compraId,
        motivo.trim(),
      );
      onAnulada?.(resultado);
    } catch (err) {
      setError(err.message || "No se pudo anular la compra.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
      {confirmando && (
        <input
          type="text"
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la anulación..."
          className="w-full sm:w-64 p-2.5 border border-red-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
        />
      )}
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={handleAnular}
          disabled={cargando}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
        >
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Ban className="h-4 w-4" />
          )}
          {confirmando ? "Confirmar anulación" : "Anular Compra"}
        </button>
        {confirmando && (
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              setMotivo("");
              setError("");
            }}
            className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
