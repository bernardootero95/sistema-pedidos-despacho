import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Info, Loader2, Search } from "lucide-react";
import { usePhysicalCount } from "../hooks/usePhysicalCount";
import { useClientPagination } from "../../../hooks/useClientPagination";
import { Pagination } from "../../../components/ui/Pagination";
import { useToast } from "../../../context/useToast";
import { diferenciaFila } from "../utils/physicalCountCalc";
import { exportarHojaConteo } from "../utils/physicalCountExcel";
import { ESTILOS_ESTADO_TOMA, ETIQUETAS_ESTADO_TOMA } from "../utils/physicalCountStatus";
import { PhysicalCountActions } from "../components/PhysicalCountActions";
import { PhysicalCountSummary } from "../components/PhysicalCountSummary";
import { PhysicalCountTable } from "../components/PhysicalCountTable";

const FILTROS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "sin_contar", etiqueta: "Sin contar" },
  { valor: "contados", etiqueta: "Contados" },
  { valor: "diferencias", etiqueta: "Con diferencia" },
];

const formatFecha = (fecha) =>
  fecha
    ? new Date(fecha).toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const PhysicalCountPage = () => {
  const { id } = useParams();
  const { showSuccess, showError, showWarning } = useToast();
  const conteo = usePhysicalCount(id);
  const { toma, lineas, contados, editable } = conteo;

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const lineasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return lineas.filter((l) => {
      if (texto && !l.nombre.toLowerCase().includes(texto) && !l.codigo.toLowerCase().includes(texto)) return false;
      const contado = contados[l.productoId];
      if (filtro === "sin_contar") return contado === null;
      if (filtro === "contados") return contado !== null;
      if (filtro === "diferencias") {
        const diferencia = editable ? diferenciaFila(l.cantidadSistema, contado) : l.diferencia;
        return diferencia !== null && diferencia !== 0;
      }
      return true;
    });
  }, [lineas, contados, busqueda, filtro, editable]);

  // Cambiar de filtro o búsqueda vuelve a la primera página.
  const paginacion = useClientPagination(lineasFiltradas, { resetKey: `${busqueda}|${filtro}` });

  const handleGuardar = async () => {
    try {
      const guardados = await conteo.guardar();
      if (guardados > 0) showSuccess(`Conteo guardado (${guardados} ${guardados === 1 ? "producto" : "productos"}).`);
    } catch (err) {
      showError(err.message);
    }
  };

  const handleAplicar = async () => {
    try {
      const { ajustados, sin_cambio: sinCambio, sin_contar: sinContar } = await conteo.aplicar();
      showSuccess(`Toma aplicada: ${ajustados} ajustados, ${sinCambio} sin diferencia, ${sinContar} sin contar.`);
    } catch (err) {
      showError(err.message);
    }
  };

  const handleCancelar = async () => {
    try {
      await conteo.cancelar();
      showSuccess("Toma física cancelada.");
    } catch (err) {
      showError(err.message);
    }
  };

  const handleImportado = (conteos) => {
    conteo.aplicarImportados(conteos);
    showWarning(`${conteos.size} conteos cargados en pantalla. Presiona «Guardar conteo» para conservarlos.`);
  };

  const handleExportar = async () => {
    try {
      await exportarHojaConteo({ lineas, contados, nombreArchivo: `toma-fisica-${toma.numero_toma}` });
    } catch (err) {
      showError("No se pudo exportar la hoja: " + err.message);
    }
  };

  if (conteo.loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        Cargando toma física...
      </div>
    );
  }

  if (conteo.error) {
    return <div className="p-8 text-center text-red-500">Error: {conteo.error}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col gap-4 p-4 sm:p-6 bg-white border-b border-slate-200">
        <Link to="/bodega/toma-fisica" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 w-fit">
          <ArrowLeft className="h-4 w-4" />
          Tomas físicas
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
              Toma física #{toma.numero_toma}
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${ESTILOS_ESTADO_TOMA[toma.estado]}`}
              >
                {ETIQUETAS_ESTADO_TOMA[toma.estado]}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Creada el {formatFecha(toma.creado)} por {toma.usuario?.nombre_completo}
              {toma.estado === "aplicada" &&
                ` · aplicada el ${formatFecha(toma.fecha_aplicacion)} por ${toma.aplicador?.nombre_completo}`}
            </p>
          </div>

          {editable && (
            <PhysicalCountActions
              lineas={lineas}
              pendientes={conteo.pendientes.length}
              trabajando={conteo.trabajando}
              hayContados={conteo.resumen.contados > 0}
              onExportar={handleExportar}
              onImportado={handleImportado}
              onErrorImportacion={showError}
              onGuardar={handleGuardar}
              onAplicar={handleAplicar}
              onCancelar={handleCancelar}
            />
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">
        {editable && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              «Sistema» es lo que había en bodega al crear la toma (disponible más pendiente por entregar). Cuenta
              todo lo que hay físicamente, incluso lo reservado para pedidos. Los productos que dejes sin contar no se
              modifican. Al aplicar, la diferencia de cada producto contado se suma o resta al inventario disponible.
            </p>
          </div>
        )}

        <PhysicalCountSummary resumen={conteo.resumen} />

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-sm">
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
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 w-fit" role="group" aria-label="Filtrar productos">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filtro === f.valor ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <PhysicalCountTable
          lineas={paginacion.pageItems}
          digitados={conteo.digitados}
          contados={contados}
          errors={conteo.errors}
          editable={editable}
          onDigitar={conteo.digitar}
          onBlur={conteo.validarCampo}
        />

        <Pagination
          currentPage={paginacion.currentPage}
          totalPages={paginacion.totalPages}
          onPageChange={paginacion.setCurrentPage}
          pageSize={paginacion.pageSize}
          onPageSizeChange={paginacion.setPageSize}
          pageSizeOptions={[25, 50, 100, 200]}
          totalItems={paginacion.totalItems}
        />
      </div>
    </div>
  );
};
