import { useEffect, useState } from "react";
import { X, History, Loader2 } from "lucide-react";
import { purchaseService } from "../services/purchaseService";

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/**
 * Historial de costo de compra de un producto puntual: de dónde sale
 * "cuándo un producto subió o bajó de precio de costo" pedido por el
 * usuario, sin necesidad de una tabla de historial aparte (se consulta
 * directo de compras_detalle vía purchaseService.getHistorialCostoProducto).
 */
export const PurchaseCostHistoryModal = ({ producto, onClose }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!producto) return;
    queueMicrotask(() => {
      setLoading(true);
      setError("");
      purchaseService
        .getHistorialCostoProducto(producto.id)
        .then(setHistorial)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [producto]);

  if (!producto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="text-primary w-5 h-5" />
              Historial de Costo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {producto.codigo} - {producto.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Este producto no tiene compras registradas.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historial.map((item, index) => (
                <div
                  key={index}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Compra #{item.compra?.numero_compra}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.compra?.fecha_compra)} ·{" "}
                      {item.compra?.proveedor?.nombre_comercial}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(item.costo_unitario)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      x {item.cantidad}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
