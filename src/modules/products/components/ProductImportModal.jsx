import { useRef, useState } from "react";
import { productService } from "../services/productService";
import { parseProductosExcel } from "../utils/productImportParser";
import {
  X,
  FileSpreadsheet,
  Upload,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const ProductImportModal = ({ onSuccess, onCancel }) => {
  const inputRef = useRef(null);

  const [archivo, setArchivo] = useState(null);
  const [productos, setProductos] = useState([]);
  const [erroresFilas, setErroresFilas] = useState([]);
  const [totalFilas, setTotalFilas] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [resultado, setResultado] = useState(null);

  const limpiarSeleccion = () => {
    setArchivo(null);
    setProductos([]);
    setErroresFilas([]);
    setTotalFilas(0);
    setErrorArchivo("");
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResultado(null);
    setErrorArchivo("");
    setArchivo(file);
    setIsParsing(true);
    try {
      const { productos: filasValidas, errores, totalFilas: total } =
        await parseProductosExcel(file);
      setProductos(filasValidas);
      setErroresFilas(errores);
      setTotalFilas(total);
    } catch (error) {
      setErrorArchivo(error.message);
      setProductos([]);
      setErroresFilas([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmar = async () => {
    setErrorArchivo("");
    setIsSubmitting(true);
    try {
      const resumen = await productService.importarProductosExcel(productos);
      setResultado(resumen);
    } catch (error) {
      setErrorArchivo(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Cargar Productos desde Excel
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sincronización manual mientras se conecta el ERP.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {resultado ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">Importación completada.</p>
                <p className="mt-1">
                  {resultado.creados} producto(s) nuevo(s) creados,{" "}
                  {resultado.actualizados} con precio y existencia
                  actualizados.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p>
                  El archivo debe tener las columnas{" "}
                  <strong>cod_inv, nom_inv, existencia, vtotal</strong> (puede
                  traer otras, se ignoran).
                </p>
                <p>
                  Si el código ya existe en el catálogo, se actualiza el
                  precio y la cantidad disponible. Si no existe, se crea
                  como producto <strong>gravado con IVA 19%</strong>.
                </p>
              </div>

              {errorArchivo && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{errorArchivo}</p>
                </div>
              )}

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">
                  {archivo ? archivo.name : "Selecciona el archivo .xlsx"}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {isParsing && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Leyendo archivo...
                </div>
              )}

              {!isParsing && archivo && !errorArchivo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {productos.length} de {totalFilas} fila(s) listas para
                    importar.
                  </div>

                  {erroresFilas.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <p className="font-bold flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {erroresFilas.length} fila(s) se van a omitir
                      </p>
                      <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                        {erroresFilas.slice(0, 20).map((e, i) => (
                          <li key={i}>
                            Fila {e.fila}: {e.motivo}
                          </li>
                        ))}
                        {erroresFilas.length > 20 && (
                          <li>y {erroresFilas.length - 20} más...</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          {resultado ? (
            <button
              type="button"
              onClick={() => onSuccess()}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow-sm transition-all"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              {archivo && !errorArchivo && (
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  disabled={isParsing || isSubmitting}
                  className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cambiar archivo
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={isParsing || isSubmitting || productos.length === 0}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isSubmitting
                  ? "Importando..."
                  : `Importar ${productos.length || ""}`.trim()}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
