import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, PiggyBank } from "lucide-react";
import { reportService } from "../services/reportService";
import { useToast } from "../../../context/useToast";
import { calcularRangoInforme, describirPeriodo, mesLocalISO } from "../utils/salesReportPeriod";
import { validateProfitReportField, validateProfitReportFilters } from "../utils/profitReportValidations";
import { exportarInformeUtilidadExcel } from "../utils/profitReportExcelUtils";
import { ProfitReportFiltersForm } from "../components/ProfitReportFiltersForm";
import { ProfitReportSummary } from "../components/ProfitReportSummary";
import { ProfitReportTable } from "../components/ProfitReportTable";

/** Consulta el informe del mes y lo devuelve junto con el mes usado. */
const consultarInforme = async (mes) => {
  const rango = calcularRangoInforme({ tipo: "mensual", mes });
  const datos = await reportService.obtenerInformeUtilidad(rango);
  return { ...datos, mes };
};

const periodoLegible = (mes) => describirPeriodo({ tipo: "mensual", mes });

export const ProfitReportPage = () => {
  const { showError } = useToast();

  const [filtros, setFiltros] = useState(() => ({ mes: mesLocalISO() }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Igual que SalesReportPage: el informe guarda el mes con que se generó,
  // así la pantalla y el Excel siguen coherentes si se cambia el filtro sin
  // volver a generar.
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);

  const handleChange = (campo, valor) => {
    const siguiente = { ...filtros, [campo]: valor };
    setFiltros(siguiente);
    if (touched[campo]) {
      setErrors((prev) => ({ ...prev, [campo]: validateProfitReportField(campo, valor, siguiente) }));
    }
  };

  const handleBlur = (campo, valor) => {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validateProfitReportField(campo, valor, filtros) }));
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
    aplicarResultado(consultarInforme(mesLocalISO()));
  }, []);

  const generarInforme = (mes) => {
    setLoading(true);
    aplicarResultado(consultarInforme(mes));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validateProfitReportFilters(filtros);
    setErrors(formErrors);
    setTouched({ mes: true });
    if (Object.keys(formErrors).length > 0) return;
    generarInforme(filtros.mes);
  };

  const handleExportar = async () => {
    try {
      setExportando(true);
      await exportarInformeUtilidadExcel({
        periodo: periodoLegible(informe.mes),
        resumen: informe.resumen,
        detalle: informe.detalle,
        nombreArchivo: `utilidad-${informe.mes}`,
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
            <PiggyBank className="h-6 w-6 text-blue-600" />
            Informe de Utilidad
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ventas entregadas del mes, costo de lo vendido y utilidad bruta por producto.
          </p>
        </div>

        {informe && !loading && (
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando}
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        <ProfitReportFiltersForm
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
              Utilidad · <span className="capitalize">{periodoLegible(informe.mes)}</span>
            </h2>
            <ProfitReportSummary resumen={informe.resumen} />
            <ProfitReportTable detalle={informe.detalle} resumen={informe.resumen} />
          </>
        )}
      </div>
    </div>
  );
};
