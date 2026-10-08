import { useEffect, useMemo, useState } from "react";
import { useClientPagination } from "../../../hooks/useClientPagination";
import { Pagination } from "../../../components/ui/Pagination";
import { FileSpreadsheet, Info, Loader2, Boxes } from "lucide-react";
import { reportService } from "../services/reportService";
import { useToast } from "../../../context/useToast";
import { fechaLocalISO } from "../utils/salesReportPeriod";
import { resumirRango } from "../utils/inventoryValuation";
import { exportarInventarioRangoExcel } from "../utils/inventoryReportExcelUtils";
import { validateInventoryReportField, validateInventoryReportFilters } from "../utils/inventoryReportValidations";
import { InventoryReportFiltersForm } from "../components/InventoryReportFiltersForm";
import { InventoryReportSummary } from "../components/InventoryReportSummary";
import { InventoryReportTable } from "../components/InventoryReportTable";
import { ValuationBaseSelector } from "../components/ValuationBaseSelector";

const filtrosIniciales = () => {
  const hoy = fechaLocalISO();
  return { fechaDesde: `${hoy.slice(0, 7)}-01`, fechaHasta: hoy };
};

/** Consulta el informe y lo devuelve junto con el rango usado. */
const consultarInforme = async (filtros) => {
  const filas = await reportService.obtenerInformeInventario(filtros);
  return { filas, fechaDesde: filtros.fechaDesde, fechaHasta: filtros.fechaHasta };
};

export const InventoryReportPage = () => {
  const { showError } = useToast();

  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [base, setBase] = useState("costo");

  // El informe guarda el rango con que se generó, así la pantalla y el Excel
  // siguen coherentes si se cambia el filtro sin volver a generar.
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);

  const handleChange = (campo, valor) => {
    const siguiente = { ...filtros, [campo]: valor };
    setFiltros(siguiente);
    if (touched[campo]) {
      setErrors((prev) => ({ ...prev, [campo]: validateInventoryReportField(campo, valor, siguiente) }));
    }
    // Cambiar "desde" puede invalidar o validar "hasta" (rango).
    if (campo === "fechaDesde" && touched.fechaHasta) {
      setErrors((prev) => ({
        ...prev,
        fechaHasta: validateInventoryReportField("fechaHasta", siguiente.fechaHasta, siguiente),
      }));
    }
  };

  const handleBlur = (campo, valor) => {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validateInventoryReportField(campo, valor, filtros) }));
  };

  const aplicarResultado = (consulta) =>
    consulta
      .then((resultado) => {
        setInforme(resultado);
        setError("");
      })
      .catch((err) => {
        setError(err.message);
        setInforme(null);
      })
      .finally(() => setLoading(false));

  // Al entrar se muestra directamente el mes en curso (por eso `loading`
  // arranca en true).
  useEffect(() => {
    aplicarResultado(consultarInforme(filtrosIniciales()));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validateInventoryReportFilters(filtros);
    setErrors(formErrors);
    setTouched({ fechaDesde: true, fechaHasta: true });
    if (Object.keys(formErrors).length > 0) return;
    setLoading(true);
    aplicarResultado(consultarInforme(filtros));
  };

  // Los totales se calculan sobre todas las filas; la paginación solo acota lo que se dibuja.
  const { totales, sinCosto } = useMemo(() => resumirRango(informe?.filas || [], base), [informe, base]);
  const paginacion = useClientPagination(informe?.filas || [], { resetKey: informe });

  const handleExportar = async () => {
    try {
      setExportando(true);
      await exportarInventarioRangoExcel({
        periodo: `${informe.fechaDesde} a ${informe.fechaHasta}`,
        base,
        filas: informe.filas,
        totales,
        nombreArchivo: `inventario-${informe.fechaDesde}-a-${informe.fechaHasta}`,
      });
    } catch (err) {
      showError("No se pudo exportar el informe: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-blue-600" />
            Informe de Inventario
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Inventario inicial, compras, ventas, preventa y mercancía disponible en un rango de fechas.
          </p>
        </div>

        {informe && !loading && (
          <div className="flex flex-wrap items-center gap-2">
            <ValuationBaseSelector base={base} onChange={setBase} />
            <button
              type="button"
              onClick={handleExportar}
              disabled={exportando}
              className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        <InventoryReportFiltersForm
          filtros={filtros}
          errors={errors}
          touched={touched}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {loading && (
          <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            Generando informe...
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-red-500 bg-white border border-slate-200 rounded-xl">Error: {error}</div>
        )}

        {!loading && informe && (
          <>
            <h2 className="text-sm font-semibold text-slate-600">
              Inventario · {informe.fechaDesde} a {informe.fechaHasta}
            </h2>
            <InventoryReportSummary totales={totales} sinCosto={sinCosto} base={base} />
            <InventoryReportTable filas={paginacion.pageItems} totales={totales} base={base} />
            <Pagination
              currentPage={paginacion.currentPage}
              totalPages={paginacion.totalPages}
              onPageChange={paginacion.setCurrentPage}
              pageSize={paginacion.pageSize}
              onPageSizeChange={paginacion.setPageSize}
              pageSizeOptions={[25, 50, 100, 200]}
              totalItems={paginacion.totalItems}
            />
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Inicial, preventa y disponible se reconstruyen desde el inventario actual con compras, entregas y
                tomas físicas; los cambios manuales de stock (carga de Excel, edición del producto) no quedan
                registrados y pueden desajustar el inicial. El costo es el último costo conocido de cada producto, no
                el de la fecha.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
