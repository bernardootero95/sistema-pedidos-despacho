import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, FileSpreadsheet, Loader2, Search, Warehouse } from "lucide-react";
import { reportService } from "../services/reportService";
import { useToast } from "../../../context/useToast";
import { fechaLocalISO } from "../utils/salesReportPeriod";
import { resumirBodega } from "../utils/inventoryValuation";
import { exportarBodegaExcel } from "../utils/inventoryReportExcelUtils";
import { WarehouseInventorySummary } from "../components/WarehouseInventorySummary";
import { WarehouseInventoryTable } from "../components/WarehouseInventoryTable";

export const WarehouseInventoryPage = () => {
  const { showError } = useToast();

  const [filas, setFilas] = useState([]);
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    reportService
      .obtenerInventarioActual()
      .then((resultado) => {
        setFilas(resultado);
        setFecha(fechaLocalISO());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // El cuadro de totales siempre es de toda la bodega; el filtro solo acota
  // la tabla.
  const resumen = useMemo(() => resumirBodega(filas), [filas]);

  const filasVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return filas;
    return filas.filter((f) => f.nombre.toLowerCase().includes(texto) || f.codigo.toLowerCase().includes(texto));
  }, [filas, busqueda]);

  const handleExportar = async () => {
    try {
      setExportando(true);
      await exportarBodegaExcel({ fecha, filas, nombreArchivo: `inventario-bodega-${fecha}` });
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
            <Warehouse className="h-6 w-6 text-blue-600" />
            Inventario de Bodega
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Lo que hay físicamente hoy: mercancía disponible más la pendiente por entregar, valorada a costo y a venta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/toma-fisica"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <ClipboardCheck className="h-4 w-4" />
            Toma física
          </Link>
          {!loading && !error && (
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
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        {loading && (
          <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            Generando informe...
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-red-500 bg-white border border-slate-200 rounded-xl">Error: {error}</div>
        )}

        {!loading && !error && (
          <>
            <WarehouseInventorySummary resumen={resumen} />

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

            <WarehouseInventoryTable filas={filasVisibles} />
          </>
        )}
      </div>
    </div>
  );
};
