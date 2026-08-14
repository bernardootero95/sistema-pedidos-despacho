import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dispatchService } from "../services/dispatchService";
import { DispatchStatusControl } from "../components/DispatchStatusControl";
import {
  Truck,
  Search,
  PlusCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  XCircle,
  User,
  Calendar,
} from "lucide-react";

export const DispatchesPage = () => {
  const navigate = useNavigate();

  const [despachos, setDespachos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Efecto para el Debounce de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Volver a la página 1 al buscar
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Cargar Despachos
  const cargarDespachos = async () => {
    try {
      setLoading(true);
      const {
        data,
        total,
        totalPages: pages,
      } = await dispatchService.getDespachosPaginados(
        currentPage,
        pageSize,
        debouncedSearch,
      );
      setDespachos(data);
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDespachos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch]);

  // Al cambiar el estado de un despacho desde la tabla o la tarjeta, se
  // actualiza solo esa fila en memoria (evita recargar toda la página
  // paginada por un solo cambio de estado).
  const handleEstadoActualizado = (despachoId, nuevoEstado) => {
    setDespachos((prev) =>
      prev.map((d) =>
        d.id === despachoId ? { ...d, estado: nuevoEstado } : d,
      ),
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Órdenes de Despacho
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestiona y monitorea las rutas de entrega de los vehículos.
          </p>
        </div>
        <button
          onClick={() => navigate("/despachos/nuevo")}
          className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <PlusCircle className="w-5 h-5" />
          Nuevo Despacho
        </button>
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
        {/* CONTROLES (BÚSQUEDA) */}
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código de despacho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="text-sm text-slate-500 hidden sm:block shrink-0">
            Total:{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span>
          </div>
        </div>

        {/* MENSAJES DE ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* ÁREA DE DATOS RESPONSIVA */}
        <div className="bg-transparent md:bg-white md:border md:border-slate-200 rounded-b-xl overflow-hidden flex-1 flex flex-col">
          {loading && despachos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 flex-1 bg-white border border-t-0 border-slate-200 md:border-none">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Cargando despachos...</p>
            </div>
          ) : despachos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-center flex-1 bg-white border border-t-0 border-slate-200 md:border-none">
              <MapPin className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">
                No se encontraron despachos
              </h3>
              <p className="max-w-sm mt-2">
                {searchTerm
                  ? "No hay resultados que coincidan con tu búsqueda."
                  : "Aún no has registrado ninguna orden de despacho en el sistema."}
              </p>
            </div>
          ) : (
            <>
              {/* === VISTA MÓVIL (Tarjetas) === */}
              <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pt-4 pb-2">
                {despachos.map((despacho) => (
                  <div
                    key={despacho.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 text-lg block leading-tight">
                          {despacho.codigo_despacho}
                        </span>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(despacho.fecha_despacho)}
                        </div>
                      </div>
                      <DispatchStatusControl
                        despachoId={despacho.id}
                        estado={despacho.estado}
                        onUpdated={(nuevoEstado) =>
                          handleEstadoActualizado(despacho.id, nuevoEstado)
                        }
                      />
                    </div>

                    <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700">
                            {despacho.vehiculo?.placa || "N/A"}
                          </span>
                          {despacho.vehiculo?.marca && (
                            <span className="text-slate-500">
                              {" "}
                              — {despacho.vehiculo.marca}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-700">
                          {despacho.repartidor?.nombre_completo || "N/A"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/despachos/${despacho.id}`)}
                      className="flex items-center justify-center gap-2 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 py-2.5 rounded-lg transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      Ver Detalles
                    </button>
                  </div>
                ))}
              </div>

              {/* === VISTA ESCRITORIO (Tabla) === */}
              <div className="hidden md:block overflow-x-auto flex-1 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                      <th className="px-6 py-4 font-medium">Código</th>
                      <th className="px-6 py-4 font-medium">Vehículo</th>
                      <th className="px-6 py-4 font-medium">Repartidor</th>
                      <th className="px-6 py-4 font-medium">Fecha Despacho</th>
                      <th className="px-6 py-4 font-medium">Estado</th>
                      <th className="px-6 py-4 font-medium text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despachos.map((despacho) => (
                      <tr
                        key={despacho.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-700">
                            {despacho.codigo_despacho}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-700">
                            {despacho.vehiculo?.placa || "N/A"}
                          </span>
                          <br />
                          <span className="text-xs text-slate-500">
                            {despacho.vehiculo?.marca || ""}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-700">
                            {despacho.repartidor?.nombre_completo || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {formatDate(despacho.fecha_despacho)}
                        </td>
                        <td className="px-6 py-4">
                          <DispatchStatusControl
                            despachoId={despacho.id}
                            estado={despacho.estado}
                            onUpdated={(nuevoEstado) =>
                              handleEstadoActualizado(despacho.id, nuevoEstado)
                            }
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() =>
                              navigate(`/despachos/${despacho.id}`)
                            }
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                            title="Ver Detalles"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PAGINACIÓN */}
          {!loading && despachos.length > 0 && (
            <div className="border-t border-slate-200 p-4 bg-white md:bg-slate-50 rounded-b-xl flex items-center justify-between mt-auto">
              <span className="text-sm text-slate-500">
                Página{" "}
                <span className="font-medium text-slate-700">
                  {currentPage}
                </span>{" "}
                de{" "}
                <span className="font-medium text-slate-700">{totalPages}</span>{" "}
                <span className="hidden sm:inline">
                  ({totalItems} registros)
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
