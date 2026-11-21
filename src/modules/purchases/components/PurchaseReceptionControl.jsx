import { useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { purchaseService } from "../services/purchaseService";
import {
  fechaIsoDe,
  getEtiquetaRecepcion,
  getEstiloRecepcion,
  hoyIso,
  puedeRecibirse,
} from "../utils/purchaseReception";
import { validateFechaRecepcion } from "../utils/purchaseValidations";

const ESTILOS_VARIANTE = {
  badge: {
    badge: "px-2.5 py-1 text-[10px]",
    boton: "px-2.5 py-1.5 text-xs rounded-lg",
    input: "w-36 p-1.5 text-xs rounded-lg",
    icono: "h-3.5 w-3.5",
  },
  buttons: {
    badge: "px-3 py-1 text-xs",
    boton: "px-4 py-2.5 text-sm rounded-xl",
    input: "w-full sm:w-44 p-2.5 text-sm rounded-xl",
    icono: "h-4 w-4",
  },
};

/**
 * Estado de recepción de una compra con la acción "Marcar como recibida".
 * Dos variantes, mismo patrón que DispatchStatusControl: `badge` compacto
 * para el listado y `buttons` para el detalle.
 *
 * Confirmación explícita: el primer clic pide la fecha de recepción (por
 * defecto hoy, validada al cambiar) y el segundo la confirma. Recibir suma
 * stock y mueve el costo en el servidor, así que quien lo use debe recargar
 * la compra en `onRecibida` en vez de adivinar el resultado.
 */
export const PurchaseReceptionControl = ({
  compra,
  variant = "badge",
  onRecibida,
}) => {
  const [confirmando, setConfirmando] = useState(false);
  const [fecha, setFecha] = useState(hoyIso);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  if (!compra || compra.estado === "anulada") return null;

  const estilos = ESTILOS_VARIANTE[variant] ?? ESTILOS_VARIANTE.badge;

  const badge = (
    <span
      className={`${estilos.badge} rounded-full font-bold uppercase tracking-wider border whitespace-nowrap ${getEstiloRecepcion(compra.estado_recepcion)}`}
    >
      {getEtiquetaRecepcion(compra.estado_recepcion)}
    </span>
  );

  if (!puedeRecibirse(compra)) return badge;

  const cancelar = () => {
    setConfirmando(false);
    setFecha(hoyIso());
    setError("");
  };

  const handleFechaChange = (valor) => {
    setFecha(valor);
    setError(validateFechaRecepcion(valor, compra.fecha_compra));
  };

  const handleRecibir = async () => {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    const errorFecha = validateFechaRecepcion(fecha, compra.fecha_compra);
    if (errorFecha) {
      setError(errorFecha);
      return;
    }

    setCargando(true);
    setError("");
    try {
      const resultado = await purchaseService.recibirCompraTransaccional(
        compra.id,
        fecha,
      );
      setConfirmando(false);
      onRecibida?.(resultado);
    } catch (err) {
      setError(err.message || "No se pudo marcar la compra como recibida.");
    } finally {
      setCargando(false);
    }
  };

  const alineacion = variant === "buttons" ? "items-end" : "items-center";

  return (
    <div
      className={`flex flex-col ${alineacion} gap-1.5`}
      onClick={(e) => e.stopPropagation()}
    >
      {badge}
      {confirmando && (
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-500">
          Fecha de recepción
          <input
            type="date"
            autoFocus
            value={fecha}
            min={fechaIsoDe(compra.fecha_compra) || undefined}
            max={hoyIso()}
            onChange={(e) => handleFechaChange(e.target.value)}
            className={`${estilos.input} border bg-white font-normal text-slate-800 outline-none focus:ring-2 ${error ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:ring-sky-100 focus:border-sky-500"}`}
          />
        </label>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleRecibir}
          disabled={cargando}
          className={`${estilos.boton} font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 whitespace-nowrap`}
        >
          {cargando ? (
            <Loader2 className={`${estilos.icono} animate-spin`} />
          ) : (
            <PackageCheck className={estilos.icono} />
          )}
          {confirmando ? "Confirmar recepción" : "Marcar como recibida"}
        </button>
        {confirmando && (
          <button
            type="button"
            onClick={cancelar}
            disabled={cargando}
            className={`${estilos.boton} font-medium text-slate-500 hover:bg-slate-100 transition-colors`}
          >
            Cancelar
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium max-w-56 text-right">
          {error}
        </p>
      )}
    </div>
  );
};
