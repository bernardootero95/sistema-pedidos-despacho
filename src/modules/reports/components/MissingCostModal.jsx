import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Pagination } from "../../../components/ui/Pagination";
import { useClientPagination } from "../../../hooks/useClientPagination";
import { productService } from "../../products/services/productService";
import { validateProductField } from "../../products/utils/productValidations";
import { formatMoneda } from "../utils/salesReportFormat";

// Acepta coma decimal (como se escribe en Colombia).
const normalizarCosto = (valor) => String(valor ?? "").trim().replace(",", ".");

/**
 * Valida el costo digitado de una fila. Vacío es válido (se deja sin costo).
 * Reutiliza la regla del formulario de producto para que ambos acepten lo
 * mismo.
 */
const validarCostoDigitado = (valor) => validateProductField("costo", normalizarCosto(valor), {});

/**
 * Modal para asignar el costo a los productos que no lo tienen. Solo se
 * guardan las filas con costo digitado; el resto queda como está. Al guardar
 * entrega a `onGuardado` un Map productoId → costo para que la pantalla
 * actualice sus filas sin recargar (el costo no tiene efectos en cascada).
 *
 * @param {{ productos: Array<{productoId: string, codigo: string, nombre: string, precioVenta: number}>, onGuardado: (costos: Map<string, number>) => void, onCancel: () => void }} props
 */
export const MissingCostModal = ({ productos, onGuardado, onCancel }) => {
  const [digitados, setDigitados] = useState({});
  const [errors, setErrors] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.codigo.toLowerCase().includes(texto));
  }, [productos, busqueda]);

  const paginacion = useClientPagination(visibles, { pageSize: 25, resetKey: busqueda });
  const llenos = Object.values(digitados).filter((v) => normalizarCosto(v) !== "").length;

  const handleChange = (productoId, valor) => {
    setDigitados((prev) => ({ ...prev, [productoId]: valor }));
    setErrors((prev) => {
      const mensaje = validarCostoDigitado(valor);
      if (!mensaje && !prev[productoId]) return prev;
      return { ...prev, [productoId]: mensaje };
    });
  };

  const handleBlur = (productoId, valor) => {
    setErrors((prev) => ({ ...prev, [productoId]: validarCostoDigitado(valor) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = {};
    Object.entries(digitados).forEach(([productoId, valor]) => {
      const mensaje = validarCostoDigitado(valor);
      if (mensaje) formErrors[productoId] = mensaje;
    });
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) {
      setErrorGeneral("Corrige los costos marcados en rojo antes de guardar.");
      return;
    }

    const costos = Object.entries(digitados)
      .filter(([, valor]) => normalizarCosto(valor) !== "")
      .map(([productoId, valor]) => ({ productoId, costo: Number(normalizarCosto(valor)) }));
    if (costos.length === 0) {
      setErrorGeneral("Digita el costo de al menos un producto.");
      return;
    }

    setGuardando(true);
    setErrorGeneral("");
    try {
      await productService.asignarCostosProductos(costos);
      onGuardado(new Map(costos.map((c) => [c.productoId, c.costo])));
    } catch (err) {
      setErrorGeneral(err.message);
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Asignar costos faltantes</h2>
            <p className="text-sm text-slate-500 mt-1">
              {productos.length} {productos.length === 1 ? "producto no tiene" : "productos no tienen"} costo. Digita el
              costo unitario de compra; los que dejes vacíos no se modifican. La próxima compra lo actualiza.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={guardando}
            aria-label="Cerrar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:px-6 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre"
              aria-label="Buscar producto"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl outline-none text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm sticky top-0">
                <th className="p-3 whitespace-nowrap">Código</th>
                <th className="p-3">Producto</th>
                <th className="p-3 text-right whitespace-nowrap">Precio de venta</th>
                <th className="p-3 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginacion.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    No hay productos que coincidan.
                  </td>
                </tr>
              ) : (
                paginacion.pageItems.map((p) => {
                  const mensaje = errors[p.productoId];
                  return (
                    <tr key={p.productoId}>
                      <td className="p-3 text-slate-600">{p.codigo}</td>
                      <td className="p-3 font-medium text-slate-800 max-w-xs truncate" title={p.nombre}>
                        {p.nombre}
                      </td>
                      <td className="p-3 text-right text-slate-600 whitespace-nowrap">{formatMoneda(p.precioVenta)}</td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={digitados[p.productoId] ?? ""}
                            placeholder="—"
                            aria-label={`Costo de ${p.nombre}`}
                            aria-invalid={Boolean(mensaje)}
                            onChange={(e) => handleChange(p.productoId, e.target.value)}
                            onBlur={(e) => handleBlur(p.productoId, e.target.value)}
                            className={`w-32 px-3 py-2 border rounded-lg outline-none text-sm text-right bg-white ${
                              mensaje
                                ? "border-red-400 focus:ring-2 focus:ring-red-200"
                                : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            }`}
                          />
                          {mensaje && <p className="text-xs text-red-600 mt-1">{mensaje}</p>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 sm:px-6 border-t border-slate-200 flex flex-col gap-3">
          <Pagination
            currentPage={paginacion.currentPage}
            totalPages={paginacion.totalPages}
            onPageChange={paginacion.setCurrentPage}
            pageSize={paginacion.pageSize}
            onPageSizeChange={paginacion.setPageSize}
            pageSizeOptions={[25, 50, 100]}
            totalItems={paginacion.totalItems}
          />
          {errorGeneral && <p className="text-sm text-red-600">{errorGeneral}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={guardando}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || llenos === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar costos{llenos > 0 ? ` (${llenos})` : ""}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
