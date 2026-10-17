import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";
import { settingsService } from "../services/settingsService";
import {
  TIPOS_LIMITE_FACTURACION,
  validateLimiteFacturacionField,
  validateLimiteFacturacionForm,
} from "../utils/limiteFacturacionValidations";
import { formatCurrencyPdf } from "../../orders/utils/print/formato";

const PERIODO = { mensual: "este mes", diaria: "hoy" };

/**
 * Límite de la facturación electrónica automática: ilimitada, mensual o
 * diaria (hora de Colombia). Muestra cuánto se lleva facturado en el periodo.
 * El formulario nace de la configuración guardada: la página lo remonta
 * (key) cuando esta cambia. La regla la aplica el servidor (iniciar_operacion_ingefact); acá solo se
 * configura y se informa.
 */
export const FacturacionLimiteCard = () => {
  const settings = useSettings();
  const { showError, showSuccess } = useToast();
  const [form, setForm] = useState({
    tipo: settings.facturacionLimiteTipo,
    valor: settings.facturacionLimiteValor ?? "",
  });
  const [tocados, setTocados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [consumo, setConsumo] = useState(null);

  const { facturacionLimiteTipo, facturacionLimiteValor, recargar } = settings;

  useEffect(() => {
    let cancelado = false;
    settingsService
      .getConsumoLimiteFacturacion()
      .then((data) => !cancelado && setConsumo(data))
      .catch(() => !cancelado && setConsumo(null));
    return () => {
      cancelado = true;
    };
  }, [facturacionLimiteTipo, facturacionLimiteValor]);

  const errores = validateLimiteFacturacionForm(form);
  const error = (campo) =>
    tocados[campo] ? validateLimiteFacturacionField(campo, form[campo], form) : "";
  const sinCambios =
    form.tipo === facturacionLimiteTipo &&
    (form.tipo === "ilimitada" || Number(form.valor) === Number(facturacionLimiteValor));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setTocados({ tipo: true, valor: true });
    if (Object.keys(errores).length > 0) return;
    setGuardando(true);
    try {
      await settingsService.actualizarLimiteFacturacion(form.tipo, form.valor);
      await recargar();
      showSuccess("Límite de facturación actualizado.");
    } catch (err) {
      showError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={handleGuardar}
      className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
          <Gauge className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900">Límite de facturación electrónica</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Limita lo que se envía solo a la DIAN. Se compara con el total de las facturas
            enviadas en el periodo (las anuladas no cuentan, hora de Colombia). Si una factura
            deja el total pasado del límite en menos del 10 %, se envía y las siguientes ya no;
            si lo pasaría en más del 10 %, esa no se envía pero la siguiente se evalúa. Las
            no enviadas se pueden emitir a mano con «Enviar Factura», que no tiene límite.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de límite">
        {TIPOS_LIMITE_FACTURACION.map(({ valor, etiqueta, detalle }) => (
          <label
            key={valor}
            className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
              form.tipo === valor
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="facturacion_limite_tipo"
              value={valor}
              checked={form.tipo === valor}
              onChange={() => setForm((f) => ({ ...f, tipo: valor }))}
              className="sr-only"
            />
            <span className="block font-semibold text-slate-900">{etiqueta}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{detalle}</span>
          </label>
        ))}
      </div>

      {form.tipo !== "ilimitada" && (
        <div>
          <label htmlFor="facturacion_limite_valor" className="block text-sm font-medium text-slate-700 mb-1">
            Valor del límite {form.tipo === "mensual" ? "mensual" : "diario"} (COP)
          </label>
          <input
            id="facturacion_limite_valor"
            type="number"
            inputMode="numeric"
            min="1"
            step="any"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            onBlur={() => setTocados((t) => ({ ...t, valor: true }))}
            aria-invalid={!!error("valor")}
            className={`w-full sm:w-64 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 ${
              error("valor") ? "border-red-400" : "border-slate-300"
            }`}
          />
          {error("valor") && <p className="text-xs text-red-500 mt-1">{error("valor")}</p>}
        </div>
      )}

      {consumo?.tipo && consumo.tipo !== "ilimitada" && (
        <p className="text-sm text-slate-600">
          Facturado {PERIODO[consumo.tipo]}:{" "}
          <span className="font-semibold">{formatCurrencyPdf(consumo.facturado)}</span> de{" "}
          <span className="font-semibold">{formatCurrencyPdf(consumo.limite)}</span>
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando || sinCambios}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar límite
        </button>
      </div>
    </form>
  );
};
