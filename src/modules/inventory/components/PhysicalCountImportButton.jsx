import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { leerConteoDesdeExcel } from "../utils/physicalCountExcel";

/**
 * Botón para cargar el conteo desde un Excel (columnas `codigo` y `contado`).
 * Lee y cruza el archivo con los productos de la toma; entrega los conteos
 * válidos a `onImportado` (que solo los muestra en pantalla, sin guardar) y
 * muestra las filas con error para que se corrijan.
 */
export const PhysicalCountImportButton = ({ productos, onImportado, onError, disabled }) => {
  const inputRef = useRef(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errores, setErrores] = useState([]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLeyendo(true);
    setErrores([]);
    try {
      const { conteos, errores: erroresFilas } = await leerConteoDesdeExcel(file, productos);
      setErrores(erroresFilas);
      if (conteos.size > 0) onImportado(conteos);
    } catch (err) {
      onError(err.message);
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || leyendo}
        className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {leyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Importar conteo
      </button>

      {errores.length > 0 && (
        <div className="basis-full p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <p className="font-semibold mb-1">
            {errores.length} {errores.length === 1 ? "fila no se importó" : "filas no se importaron"}:
          </p>
          <ul className="list-disc pl-5 space-y-0.5 max-h-32 overflow-y-auto">
            {errores.map((e) => (
              <li key={`${e.fila}-${e.motivo}`}>
                Fila {e.fila}: {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
