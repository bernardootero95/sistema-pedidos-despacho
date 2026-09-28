import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { reportService } from "../services/reportService";
import { userService } from "../../users/services/userService";
import { useToast } from "../../../context/useToast";
import {
  calcularRangoInforme,
  describirPeriodo,
  fechaLocalISO,
  mesLocalISO,
  obtenerCategoriasDetalle,
  tituloInforme,
} from "../utils/salesReportPeriod";
import { validateSalesReportField, validateSalesReportFilters } from "../utils/salesReportValidations";
import { exportarInformeVentasCarta, exportarInformeVentasTiquete } from "../utils/salesReportPdfUtils";
import { exportarInformeVentasExcel } from "../utils/salesReportExcelUtils";
import { SalesReportFiltersForm } from "../components/SalesReportFiltersForm";
import { SalesReportSummary } from "../components/SalesReportSummary";
import { SalesReportDetail } from "../components/SalesReportDetail";
import { SalesReportExportActions } from "../components/SalesReportExportActions";

const filtrosIniciales = () => ({ tipo: "diario", fecha: fechaLocalISO(), mes: mesLocalISO(), vendedorId: "" });

const EXPORTADORES = {
  excel: exportarInformeVentasExcel,
  carta: exportarInformeVentasCarta,
  tiquete: exportarInformeVentasTiquete,
};

/** Consulta el informe y lo devuelve junto con los filtros y el rango usados. */
const consultarInforme = async (filtrosConsulta) => {
  const rango = calcularRangoInforme(filtrosConsulta);
  const datos = await reportService.obtenerInformeVentas({ ...rango, vendedorId: filtrosConsulta.vendedorId });
  return { ...datos, filtros: filtrosConsulta, rango };
};

export const SalesReportPage = () => {
  const { showError } = useToast();

  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [vendedores, setVendedores] = useState([]);

  // El informe guarda los filtros con que se generó: si el usuario cambia
  // el mes sin volver a generar, la pantalla y los exportes siguen siendo
  // coherentes con los datos mostrados.
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(null);

  useEffect(() => {
    userService.getUsuariosFacturadores().then(setVendedores).catch(() => {});
  }, []);

  const handleChange = (campo, valor) => {
    const siguiente = { ...filtros, [campo]: valor };
    setFiltros(siguiente);
    if (campo === "tipo") {
      setErrors({});
      setTouched({});
    } else if (touched[campo]) {
      setErrors((prev) => ({ ...prev, [campo]: validateSalesReportField(campo, valor, siguiente) }));
    }
  };

  const handleBlur = (campo, valor) => {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validateSalesReportField(campo, valor, filtros) }));
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

  // Al entrar se muestra directamente la venta del día de hoy (por eso
  // `loading` arranca en true).
  useEffect(() => {
    aplicarResultado(consultarInforme(filtrosIniciales()));
  }, []);

  const generarInforme = (filtrosConsulta) => {
    setLoading(true);
    aplicarResultado(consultarInforme(filtrosConsulta));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validateSalesReportFilters(filtros);
    setErrors(formErrors);
    setTouched({ fecha: true, mes: true });
    if (Object.keys(formErrors).length > 0) return;
    generarInforme(filtros);
  };

  const categorias = useMemo(() => obtenerCategoriasDetalle(informe?.filtros.tipo), [informe]);

  const construirDatosExportacion = () => {
    const { filtros: f, rango } = informe;
    const sufijoArchivo = f.tipo === "mensual" ? f.mes : rango.fechaDesde;
    return {
      titulo: tituloInforme(f.tipo),
      periodo: describirPeriodo(f),
      vendedorLabel: f.vendedorId ? vendedores.find((v) => v.id === f.vendedorId)?.nombre_completo : null,
      categorias,
      resumen: informe.resumen,
      detalle: informe.detalle,
      nombreArchivo: `${f.tipo === "mensual" ? "cierre-mes" : "venta-diaria"}-${sufijoArchivo}`,
    };
  };

  const handleExportar = async (formato) => {
    try {
      setExportando(formato);
      await EXPORTADORES[formato](construirDatosExportacion());
    } catch (err) {
      showError("No se pudo exportar el informe: " + err.message);
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Informe de Ventas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Venta diaria y cierre de mes: preventa, ventas entregadas, anulaciones y pendientes.
          </p>
        </div>

        {informe && !loading && <SalesReportExportActions onExportar={handleExportar} exportando={exportando} />}
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        <SalesReportFiltersForm
          filtros={filtros}
          errors={errors}
          touched={touched}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          vendedores={vendedores}
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
              {tituloInforme(informe.filtros.tipo)} ·{" "}
              <span className="capitalize">{describirPeriodo(informe.filtros)}</span>
            </h2>
            <SalesReportSummary resumen={informe.resumen} categorias={categorias} />
            <SalesReportDetail
              key={`${informe.rango.fechaDesde}-${informe.filtros.vendedorId}`}
              detalle={informe.detalle}
              categorias={categorias}
            />
          </>
        )}
      </div>
    </div>
  );
};
