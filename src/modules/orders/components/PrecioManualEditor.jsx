import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { parsePrecioManual, validators } from "../utils/orderValidations";

/**
 * Precio unitario de una línea del pedido con edición en el lugar, para los
 * perfiles autorizados a cambiar el precio al vender (Pagos y Facturación).
 * Valida mientras se escribe (mismo diccionario que el resto de pedidos);
 * Enter o el botón ✓ aplican el precio, Escape o ✕ cancelan.
 *
 * Presentación + estado local de la edición: el precio vive en el carrito
 * (useCarritoPedido) y el servidor vuelve a validar permiso y valor al guardar.
 */
export const PrecioManualEditor = ({ precio, precioLista, esManual, formatCurrency, onGuardar }) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");

  const abrir = () => {
    setTexto(String(precio));
    setError("");
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setError("");
  };

  const handleChange = (valor) => {
    setTexto(valor);
    setError(validators.precioManual(valor));
  };

  const aplicar = () => {
    const mensaje = validators.precioManual(texto);
    if (mensaje) {
      setError(mensaje);
      return;
    }
    onGuardar(parsePrecioManual(texto));
    setEditando(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      aplicar();
    } else if (e.key === "Escape") {
      cancelar();
    }
  };

  if (editando) {
    return (
      <div className="mt-1">
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={texto}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Precio unitario"
            aria-invalid={Boolean(error)}
            className={`w-28 px-2 py-1 border rounded-lg outline-none text-xs text-right bg-white ${
              error
                ? "border-red-400 focus:ring-2 focus:ring-red-200"
                : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            }`}
          />
          <button
            type="button"
            onClick={aplicar}
            aria-label="Aplicar precio"
            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancelar}
            aria-label="Cancelar cambio de precio"
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-0.5">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
      <p className="text-xs font-semibold text-blue-600">{formatCurrency(precio)} c/u</p>
      <button
        type="button"
        onClick={abrir}
        aria-label="Cambiar precio"
        title="Cambiar precio"
        className="p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
      >
        <Pencil className="h-3 w-3" />
      </button>
      {esManual && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
          Precio manual · lista {formatCurrency(precioLista)}
        </span>
      )}
    </div>
  );
};
