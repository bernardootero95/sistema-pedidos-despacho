import { useEffect, useState } from "react";
import { FileBarChart, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { reportService } from "../services/reportService";
import { userService } from "../../users/services/userService";
import { clientService } from "../../clients/services/clientService";
import { validateReportField, validateReportFilters } from "../utils/reportFiltersValidations";
import { exportarInformeProductosPdf } from "../utils/reportPdfUtils";
import { exportarInformeExcel } from "../utils/reportExcelUtils";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { useToast } from "../../../context/useToast";
import { ReportFiltersForm } from "../components/ReportFiltersForm";
import { ReportResultsTable } from "../components/ReportResultsTable";

const FILTROS_INICIALES = { campoFecha: "fecha_entrega" };

export const ProductsReportPage = () => {
  const { showError } = useToast();

  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [vendedores, setVendedores] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Solo para poblar los selects de filtro; no depende de la consulta del informe.
  useEffect(() => {
    userService.getUsuariosFacturadores().then(setVendedores).catch(() => {});
    clientService.getClientesActivos().then(setClientes).catch(() => {});
  }, []);

  const handleChange = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
    if (touched[campo]) {
      setErrors((prev) => ({ ...prev, [campo]: validateReportField(campo, valor, filtros) }));
    }
  };

  const handleBlur = (campo, valor) => {
    setTouched((prev) => ({ ...prev, [campo]: true }));
    setErrors((prev) => ({ ...prev, [campo]: validateReportField(campo, valor, filtros) }));
  };

  const limpiarFiltros = () => {
    setFiltros({ ...FILTROS_INICIALES, fechaDesde: filtros.fechaDesde, fechaHasta: filtros.fechaHasta });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateReportFilters(filtros);
    setErrors(formErrors);
    setTouched({ fechaDesde: true, fechaHasta: true });
    if (Object.keys(formErrors).length > 0) return;

    try {
      setLoading(true);
      setError("");
      const data = await reportService.obtenerInformeProductos(filtros);
      setFilas(data);
      setConsultado(true);
    } catch (err) {
      setError(err.message);
      setFilas([]);
    } finally {
      setLoading(false);
    }
  };

  const buildEtiquetasFiltros = () => ({
    fechaDesde: filtros.fechaDesde,
    fechaHasta: filtros.fechaHasta,
    campoFecha: filtros.campoFecha,
    estadoLabel: filtros.estado
      ? filtros.estado.charAt(0).toUpperCase() + filtros.estado.slice(1).replace("_", " ")
      : null,
    vendedorLabel: filtros.vendedorId
      ? vendedores.find((v) => v.id === filtros.vendedorId)?.nombre_completo
      : null,
    clienteLabel: filtros.clienteId
      ? getNombreCliente(clientes.find((c) => c.id === filtros.clienteId))
      : null,
  });

  const handleExportarPdf = async () => {
    try {
      setExportando(true);
      await exportarInformeProductosPdf(filas, buildEtiquetasFiltros());
    } catch (err) {
      showError("No se pudo generar el PDF del informe: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  const handleExportarExcel = async () => {
    try {
      setExportando(true);
      await exportarInformeExcel(filas, `informe-productos-${filtros.fechaDesde}-a-${filtros.fechaHasta}.xlsx`);
    } catch (err) {
      showError("No se pudo generar el Excel del informe: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  const hayResultados = consultado && filas.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-blue-600" />
            Informe de Productos por Pedido
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cantidades y valores movidos por producto en un rango de fechas.
          </p>
        </div>

        {hayResultados && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportarPdf}
              disabled={exportando}
              className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </button>
            <button
              onClick={handleExportarExcel}
              disabled={exportando}
              className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
        <ReportFiltersForm
          filtros={filtros}
          errors={errors}
          touched={touched}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          onLimpiar={limpiarFiltros}
          vendedores={vendedores}
          clientes={clientes}
          loading={loading}
        />

        <ReportResultsTable filas={filas} loading={loading} error={error} consultado={consultado} />
      </div>
    </div>
  );
};
