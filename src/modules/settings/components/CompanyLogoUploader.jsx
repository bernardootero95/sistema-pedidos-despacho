import { useRef, useState } from "react";
import { companyService } from "../services/companyService";
import { validateLogo } from "../utils/companyValidations";
import { useToast } from "../../../context/useToast";
import { ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";

/**
 * Logo de la empresa para los comprobantes impresos. Quitarlo pide un
 * segundo click de confirmación (mismo patrón que DispatchStatusControl).
 */
export const CompanyLogoUploader = ({ logoUrl, logoPath, onChange }) => {
  const { showError, showSuccess } = useToast();
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const handleArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    const error = validateLogo(archivo);
    if (error) {
      showError(error);
      return;
    }

    setSubiendo(true);
    try {
      await companyService.subirLogo(archivo, logoPath);
      showSuccess("Logo actualizado.");
      onChange();
    } catch (err) {
      showError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const handleQuitar = async () => {
    if (!confirmarQuitar) {
      setConfirmarQuitar(true);
      return;
    }
    setConfirmarQuitar(false);
    setSubiendo(true);
    try {
      await companyService.eliminarLogo(logoPath);
      showSuccess("Logo eliminado.");
      onChange();
    } catch (err) {
      showError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-40 h-24 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo de la empresa" className="max-w-full max-h-full object-contain" />
        ) : (
          <ImageIcon className="w-8 h-8 text-slate-300" />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          PNG, JPG o WEBP de hasta 1 MB. Se imprime en pedidos y facturas si
          la opción "Imprimir logo" está encendida.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="px-3 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
          >
            {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {logoUrl ? "Cambiar logo" : "Subir logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={handleQuitar}
              onBlur={() => setConfirmarQuitar(false)}
              disabled={subiendo}
              className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${
                confirmarQuitar
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmarQuitar ? "¿Confirmar? Click de nuevo" : "Quitar logo"}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleArchivo}
          className="hidden"
        />
      </div>
    </div>
  );
};
